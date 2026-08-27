import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CreateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/create-salary-rule.command';
import type { SalaryRuleRepositoryPort } from '../ports/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '../ports/salary-rule.port';
import { SalaryRuleFactory } from '@/domains/service/modules/accounting/domain/factories/salary-rule.factory';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import { TaskRuleRequiresEmployeeTargetException } from '@/domains/service/modules/accounting/domain/exceptions/task-rule.exception';
import { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';

// Создание одного зарплатного правила — общая точка и для
// CreateMotivationSchemaHandler (новая схема), и для
// UpdateMotivationSchemaHandler (полная замена набора правил при PATCH, см.
// WHY там). Для правила TaskCompleted (design.md change
// salary-rule-bitrix-task, Decision 4) добавлен паттерн «сначала Bitrix,
// потом БД» с компенсацией: (1) создать задачу в Bitrix24 → получить
// bitrixTaskId, (2) сохранить правило с этим ID В ТОЙ ЖЕ Prisma-транзакции,
// что и остальные правила схемы (эта транзакция уже открыта снаружи —
// CreateMotivationSchemaHandler/UpdateMotivationSchemaHandler оборачивают
// весь сценарий в unitOfWork.run(), а salaryRuleRepo.insert() лишь
// переиспользует её, см. PrismaRepository.write). Если шаг (2) падает —
// синхронно вызывается deleteTask для только что созданной задачи; если и
// оно падает — ошибка логируется с ID задачи для ручной зачистки, исходная
// ошибка сохранения пробрасывается пользователю как есть.
@CommandHandler(CreateSalaryRuleCommand)
export class CreateSalaryRuleHandler implements ICommandHandler<
    CreateSalaryRuleCommand,
    { id: string }
> {
    private readonly logger = new Logger(CreateSalaryRuleHandler.name);

    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        protected readonly salaryRuleRepo: SalaryRuleRepositoryPort,
        protected readonly bitrixTasksService: BitrixTasksService,
    ) {}

    async execute(command: CreateSalaryRuleCommand): Promise<{ id: string }> {
        const rule = SalaryRuleFactory.create(command.rule);

        if (rule instanceof TaskCompletedEntity) {
            await this.createWithBitrixTask(rule, command);
        } else {
            await this.salaryRuleRepo.insert(rule, {
                motivationSchemaId: command.motivationSchemaId,
            });
        }

        return { id: rule.id };
    }

    private async createWithBitrixTask(
        rule: TaskCompletedEntity,
        command: CreateSalaryRuleCommand,
    ): Promise<void> {
        // Requirement "Создание правила-задачи только в схеме на сотрудника"
        // (spec.md) — форма конструктора схемы уже не предлагает
        // TaskCompleted для схемы отдела (задача 9.2, frontend), это —
        // защита на бэкенде на случай прямого запроса в обход формы:
        // без ответственного задачу Bitrix24 создать нельзя.
        if (command.responsibleId == null) {
            throw new TaskRuleRequiresEmployeeTargetException();
        }

        const config = rule.config;
        const taskId = await this.bitrixTasksService.createTask({
            title: rule.name,
            description: config.description,
            responsibleId: command.responsibleId,
            deadline: new Date(`${config.dueDate}T00:00:00.000Z`),
            period: config.period,
        });

        rule.addBitrixTaskId(taskId);

        try {
            await this.salaryRuleRepo.insert(rule, {
                motivationSchemaId: command.motivationSchemaId,
            });
        } catch (dbError) {
            try {
                await this.bitrixTasksService.deleteTask(taskId);
            } catch (compensationError) {
                this.logger.error(
                    `Компенсация не удалась: задача Bitrix24 ${taskId} ` +
                        `(правило ${rule.id}, схема ${command.motivationSchemaId}) ` +
                        'не удалена после сбоя сохранения правила — требуется ручная зачистка',
                    compensationError instanceof Error
                        ? compensationError.stack
                        : String(compensationError),
                );
            }
            throw dbError;
        }
    }
}
