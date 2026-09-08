import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CreateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/create-salary-rule.command';
import type { SalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '../../ports/motivation-schema/salary-rule.port';
import type { MotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '../../ports/motivation-schema/motivation-schema.port';
import { SalaryRuleFactory } from '@/domains/service/modules/accounting/domain/factories/salary-rule.factory';
import { NotFoundException } from '@/shared/exceptions';
import { TaskCompletionRequiresPersonalSchemaException } from '@/domains/service/modules/accounting/domain/exceptions/motivation-schema.exception';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { BITRIX_TASKS_GATEWAY } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import type { BitrixTasksGatewayPort } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import { SALARY_TASK_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-task/salary-task.port';
import type { SalaryTaskRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-task/salary-task.port';
import { resolveTaskDeadlineForCreation } from '@/domains/service/modules/accounting/application/services/salary-task/ensure-salary-task-for-period.service';
import { Period } from '@/shared/domain/period.value-object';
import { BITRIX_TASK_STATUS_NEW } from '@/integrations/bitrix/schema';
import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { TaskStatus } from '@/domains/service/modules/accounting/domain/value-objects/task-status.value-object';
import type {
    SalaryRule,
    TaskCompletionSalaryConfig,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';

// Создание одного зарплатного правила — общая точка и для
// CreateMotivationSchemaHandler (новая схема), и для
// UpdateMotivationSchemaHandler (полная замена набора правил при PATCH, см.
// WHY там).
//
// Раздел 12 tasks.md (add-task-based-salary-rule), design.md Decision 6 —
// правило TaskCompletion идёт отдельной веткой: задача Bitrix24 создаётся
// ДО записи в БД (правило без привязанной задачи бессмысленно — см. Risks
// design.md), SalaryRule+SalaryTask персистятся в одной транзакции
// (UNIT_OF_WORK), а сбой записи в БД ПОСЛЕ успешного создания задачи
// компенсируется закрытием только что созданной задачи (тот же приём, что
// CreatePayoutHandler.createPayout — компенсация ERP-стороны при откате
// локальной записи). Остальные типы правил (PayPerHour/ServiceCompleted/
// OrderPayed) идут прежним путём без изменений.
@CommandHandler(CreateSalaryRuleCommand)
export class CreateSalaryRuleHandler implements ICommandHandler<
    CreateSalaryRuleCommand,
    { id: string }
> {
    private readonly logger = new Logger(CreateSalaryRuleHandler.name);

    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        protected readonly salaryRuleRepo: SalaryRuleRepositoryPort,
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        protected readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
        @Inject(UNIT_OF_WORK)
        protected readonly unitOfWork: UnitOfWorkPort,
        @Inject(BITRIX_TASKS_GATEWAY)
        protected readonly tasksGateway: BitrixTasksGatewayPort,
        @Inject(SALARY_TASK_REPOSITORY)
        protected readonly salaryTaskRepo: SalaryTaskRepositoryPort,
    ) {}

    async execute(command: CreateSalaryRuleCommand): Promise<{ id: string }> {
        const rule = SalaryRuleFactory.create(command.rule);

        if (rule.type !== 'TaskCompletion') {
            await this.salaryRuleRepo.insert(rule, {
                motivationSchemaId: command.motivationSchemaId,
            });
            return { id: rule.id };
        }

        return this.createTaskCompletionRule(rule, command.motivationSchemaId);
    }

    private async createTaskCompletionRule(
        rule: SalaryRule,
        motivationSchemaId: string,
    ): Promise<{ id: string }> {
        const config = rule.config as TaskCompletionSalaryConfig;

        const schema =
            await this.motivationSchemaRepo.findById(motivationSchemaId);
        if (!schema) {
            throw new NotFoundException('Мотивационная схема не найдена');
        }

        const responsibleBitrixUserId =
            this.resolveResponsibleBitrixUserId(schema);
        const period = Period.current().getValue();
        const deadline = resolveTaskDeadlineForCreation(config, period);

        // design.md Decision 6 — сначала Bitrix24, до записи чего бы то ни
        // было в нашу БД: если createTask падает, правило не создаётся
        // вовсе (никакой БД-транзакции ещё не открыто).
        const { bitrixTaskId } = await this.tasksGateway.createTask({
            responsibleBitrixUserId,
            title: config.bitrixTaskTitle,
            description: config.taskDescription,
            deadline,
        });

        const task = SalaryTask.create({
            salaryRuleId: rule.id,
            period,
            deadline,
            isRecurring: config.isRecurring,
            bitrixTaskId,
            // Тот же приём, что и EnsureSalaryTaskForPeriodService (раздел
            // 11) — Bitrix24 не возвращает статус на tasks.task.add,
            // известное начальное значение "Новая" (STATUS = 2).
            taskStatus: TaskStatus.fromRaw(String(BITRIX_TASK_STATUS_NEW)),
        });

        try {
            await this.unitOfWork.run(async () => {
                await this.salaryRuleRepo.insert(rule, {
                    motivationSchemaId,
                });
                await this.salaryTaskRepo.insert(task);
            });
        } catch (dbError) {
            // Компенсация (design.md Decision 6): Bitrix24 уже создала
            // задачу, но запись в нашу БД не удалась — задача закрывается,
            // и только потом возвращается исходная ошибка; неудача
            // компенсации не маскирует исходную ошибку, только логируется
            // для ручной сверки (тот же приём, что CreatePayoutHandler).
            try {
                await this.tasksGateway.closeTask(bitrixTaskId);
            } catch (compensationError) {
                this.logger.error(
                    `Компенсация не удалась: задача Bitrix24 ${bitrixTaskId} ` +
                        `(правило TaskCompletion, схема ${motivationSchemaId}) ` +
                        'не закрыта после сбоя записи в БД — требуется ручная сверка',
                    compensationError instanceof Error
                        ? compensationError.stack
                        : String(compensationError),
                );
            }
            throw dbError;
        }

        return { id: rule.id };
    }

    // Bitrix-пользователь, на которого оформляется задача (design.md
    // Decision 2, "RESPONSIBLE_ID — сотрудник, на которого оформлено
    // правило"). Продуктовое решение: правило TaskCompletion можно завести
    // только на ЛИЧНУЮ схему (MotivationTarget.isEmployee()) — снимает
    // прежний открытый вопрос про схему отдела (естественный ключ
    // (salaryRuleId, period) допускал только одну задачу на правило, и
    // пришлось бы выбирать "первого сотрудника отдела" произвольно).
    // Ограничение проверяется здесь и распространяется на
    // UpdateMotivationSchemaHandler автоматически — тот пересоздаёт правила
    // через тот же CreateSalaryRuleCommand/этот хендлер.
    private resolveResponsibleBitrixUserId(schema: MotivationSchema): number {
        const target = schema.getProps().target;
        if (!target.isEmployee()) {
            throw new TaskCompletionRequiresPersonalSchemaException();
        }
        return target.getId();
    }
}
