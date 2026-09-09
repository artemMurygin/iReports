import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CreateShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/create-salary-rule.command';
import type { ShopSalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '../../ports/motivation-schema/salary-rule.port';
import { ShopSalaryRuleFactory } from '@/domains/shop/modules/accounting/domain/factories/salary-rule.factory';
import type { ShopMotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '../../ports/motivation-schema/motivation-schema.port';
import { NotFoundException } from '@/shared/exceptions';
import { TaskCompletionRequiresPersonalSchemaException } from '@/domains/shop/modules/accounting/domain/exceptions/motivation-schema.exception';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { BITRIX_TASKS_GATEWAY } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import type { BitrixTasksGatewayPort } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import { SHOP_SALARY_TASK_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/salary-task/salary-task.port';
import type { ShopSalaryTaskRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-task/salary-task.port';
import { resolveTaskDeadlineForCreation } from '@/domains/shop/modules/accounting/application/services/salary-task/ensure-salary-task-for-period.service';
import { Period } from '@/shared/domain/period.value-object';
import { BITRIX_TASK_STATUS_NEW } from '@/integrations/bitrix/schema';
import { ShopSalaryTask } from '@/domains/shop/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { ShopTaskStatus } from '@/domains/shop/modules/accounting/domain/value-objects/task-status.value-object';
import type {
    ShopSalaryRule,
    TaskCompletionShopSalaryConfig,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import type { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';

// Зеркало domains/service/modules/accounting/application/command/
// create-salary-rule.handler.ts (Фаза 13.5, issue #57) — независимая копия
// для направления shop.
//
// Раздел 17 tasks.md (add-task-based-salary-rule), design.md Decision 6 —
// правило TaskCompletion идёт отдельной веткой (зеркало CreateSalaryRuleHandler
// направления service, раздел 12): задача Bitrix24 создаётся ДО записи в
// БД (правило без привязанной задачи бессмысленно — см. Risks design.md),
// ShopSalaryRule+ShopSalaryTask персистятся в одной транзакции
// (UNIT_OF_WORK), а сбой записи в БД ПОСЛЕ успешного создания задачи
// компенсируется закрытием только что созданной задачи (тот же приём, что
// CreateShopPayoutHandler.createPayout). Остальные типы правил
// (PayPerHour/ProductSold/UsedProductSold) идут прежним путём без
// изменений.
@CommandHandler(CreateShopSalaryRuleCommand)
export class CreateShopSalaryRuleHandler implements ICommandHandler<
    CreateShopSalaryRuleCommand,
    { id: string }
> {
    private readonly logger = new Logger(CreateShopSalaryRuleHandler.name);

    constructor(
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        protected readonly shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort,
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        protected readonly shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        @Inject(UNIT_OF_WORK)
        protected readonly unitOfWork: UnitOfWorkPort,
        @Inject(BITRIX_TASKS_GATEWAY)
        protected readonly tasksGateway: BitrixTasksGatewayPort,
        @Inject(SHOP_SALARY_TASK_REPOSITORY)
        protected readonly salaryTaskRepo: ShopSalaryTaskRepositoryPort,
    ) {}

    async execute(
        command: CreateShopSalaryRuleCommand,
    ): Promise<{ id: string }> {
        const rule = ShopSalaryRuleFactory.create(command.rule);

        if (rule.type !== 'TaskCompletion') {
            await this.shopSalaryRuleRepo.insert(rule, {
                motivationSchemaId: command.motivationSchemaId,
            });
            return { id: rule.id };
        }

        return this.createTaskCompletionRule(rule, command.motivationSchemaId);
    }

    private async createTaskCompletionRule(
        rule: ShopSalaryRule,
        motivationSchemaId: string,
    ): Promise<{ id: string }> {
        const config = rule.config as TaskCompletionShopSalaryConfig;

        const schema =
            await this.shopMotivationSchemaRepo.findById(motivationSchemaId);
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

        const task = ShopSalaryTask.create({
            salaryRuleId: rule.id,
            period: Period.create(period),
            deadline,
            isRecurring: config.isRecurring,
            bitrixTaskId,
            // Тот же приём, что и EnsureShopSalaryTaskForPeriodService
            // (раздел 16) — Bitrix24 не возвращает статус на
            // tasks.task.add, известное начальное значение "Новая"
            // (STATUS = 2).
            taskStatus: ShopTaskStatus.fromRaw(String(BITRIX_TASK_STATUS_NEW)),
        });

        try {
            await this.unitOfWork.run(async () => {
                await this.shopSalaryRuleRepo.insert(rule, {
                    motivationSchemaId,
                });
                await this.salaryTaskRepo.insert(task);
            });
        } catch (dbError) {
            // Компенсация (design.md Decision 6): Bitrix24 уже создала
            // задачу, но запись в нашу БД не удалась — задача закрывается,
            // и только потом возвращается исходная ошибка; неудача
            // компенсации не маскирует исходную ошибку, только логируется
            // для ручной сверки (тот же приём, что CreateShopPayoutHandler).
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
    // только на ЛИЧНУЮ схему (ShopMotivationTarget.isEmployee()) — снимает
    // прежний открытый вопрос про схему отдела (естественный ключ
    // (salaryRuleId, period) допускал только одну задачу на правило, и
    // пришлось бы выбирать "первого сотрудника отдела" произвольно).
    // Ограничение проверяется здесь и распространяется на
    // UpdateShopMotivationSchemaHandler автоматически — тот пересоздаёт
    // правила через тот же CreateShopSalaryRuleCommand/этот хендлер.
    private resolveResponsibleBitrixUserId(
        schema: ShopMotivationSchema,
    ): number {
        const target = schema.getProps().target;
        if (!target.isEmployee()) {
            throw new TaskCompletionRequiresPersonalSchemaException();
        }
        return target.getId();
    }
}
