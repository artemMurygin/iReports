import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import type { TaskCompletionShopSalaryConfigRequest } from 'ireports-contracts';
import { CreateShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/create-salary-rule.command';
import type { ShopSalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '../../ports/motivation-schema/salary-rule.port';
import type { ShopMotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '../../ports/motivation-schema/motivation-schema.port';
import { ShopSalaryRuleFactory } from '@/domains/shop/modules/accounting/domain/factories/salary-rule.factory';
import { NotFoundException, ArgumentInvalidException } from '@/shared/exceptions';
import { TaskCompletionRequiresPersonalSchemaException } from '@/domains/shop/modules/accounting/domain/exceptions/motivation-schema.exception';
import type { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import type { TaskCompletionShopSalaryConfig } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { computeRecurringTaskDeadline } from '@/domains/shop/modules/accounting/domain/services/task-deadline';
import { Period } from '@/shared/domain/period.value-object';
import { CreateTaskCommand } from '@/modules/tasks/application/command/create-task/create-task.command';
import { AddTaskLinkCommand } from '@/modules/tasks/application/command/add-task-link/add-task-link.command';

// Зеркало domains/service/modules/accounting/application/command/
// create-salary-rule.handler.ts (issue #57) — независимая копия для
// направления shop.
//
// split-task-completion-rule-form — правило TaskCompletion снова создаёт задачу здесь (зеркало
// service-версии, см. её WHY): форма создания правила либо собирает буквальные поля задачи прямо в
// себе (разовое правило), либо шаблон для авто-пересоздания (регулярное) — бэкенд сам диспатчит
// `CreateTaskCommand` через CommandBus ДО вставки правила и дописывает получившийся `taskId` в уже
// построенный `config.taskIdByPeriod`. Также добавлена (ранее отсутствовавшая в этом хендлере,
// хотя exception для неё уже существовал) проверка «только на ЛИЧНУЮ схему сотрудника» — зеркало
// service, необходима и для этого change: TaskCompletion привязан к ОДНОМУ конкретному сотруднику
// (assigneeEmployeeId задачи резолвится из схемы), выбор среди сотрудников отдела был бы произвольным.
@CommandHandler(CreateShopSalaryRuleCommand)
export class CreateShopSalaryRuleHandler implements ICommandHandler<
    CreateShopSalaryRuleCommand,
    { id: string }
> {
    constructor(
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        protected readonly shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort,
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        protected readonly shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        protected readonly commandBus: CommandBus,
    ) {}

    async execute(
        command: CreateShopSalaryRuleCommand,
    ): Promise<{ id: string }> {
        const rule = ShopSalaryRuleFactory.create(command.rule);

        if (command.rule.type === 'TaskCompletion') {
            const schema = await this.assertPersonalSchema(
                command.motivationSchemaId,
            );
            await this.createTaskCompletionTask(
                rule.config as TaskCompletionShopSalaryConfig,
                command.rule.config,
                schema,
            );
        }

        await this.shopSalaryRuleRepo.insert(rule, {
            motivationSchemaId: command.motivationSchemaId,
        });

        return { id: rule.id };
    }

    // Зеркало assertPersonalSchema направления service — правило TaskCompletion можно завести
    // только на ЛИЧНУЮ схему (ShopMotivationTarget.isEmployee()), см. WHY у класса выше. Возвращает
    // саму схему — createTaskCompletionTask() резолвит из неё assigneeEmployeeId без второго похода
    // в репозиторий.
    private async assertPersonalSchema(
        motivationSchemaId: string,
    ): Promise<ShopMotivationSchema> {
        const schema =
            await this.shopMotivationSchemaRepo.findById(motivationSchemaId);
        if (!schema) {
            throw new NotFoundException('Мотивационная схема не найдена');
        }
        if (!schema.getProps().target.isEmployee()) {
            throw new TaskCompletionRequiresPersonalSchemaException();
        }
        return schema;
    }

    // Зеркало createTaskCompletionTask направления service — см. её WHY.
    private async createTaskCompletionTask(
        config: TaskCompletionShopSalaryConfig,
        request: TaskCompletionShopSalaryConfigRequest,
        schema: ShopMotivationSchema,
    ): Promise<void> {
        const assigneeEmployeeId = schema.getProps().target.getId();

        if (!request.isRecurring) {
            if (!request.taskTitle || !request.taskDeadline) {
                throw new ArgumentInvalidException(
                    'Для разового правила укажите название и дедлайн задачи',
                );
            }
            await this.createAndAttachTask(config, assigneeEmployeeId, {
                title: request.taskTitle,
                description: request.taskDescription,
                deadline: new Date(request.taskDeadline),
                links: request.taskLinks ?? [],
            });
            return;
        }

        if (request.createTaskForCurrentPeriod === false) {
            return;
        }

        await this.createAndAttachTask(config, assigneeEmployeeId, {
            title: request.taskTitleTemplate,
            description: request.taskDescriptionTemplate,
            deadline: computeRecurringTaskDeadline(
                Period.create(config.accountingPeriod),
                request.deadlineTemplate,
                request.deadlinePeriodOffset ?? 0,
            ),
            links: request.taskLinkTemplates ?? [],
        });
    }

    private async createAndAttachTask(
        config: TaskCompletionShopSalaryConfig,
        assigneeEmployeeId: number,
        task: {
            title: string;
            description?: string;
            deadline: Date;
            links: { url: string; label?: string }[];
        },
    ): Promise<void> {
        const { id: taskId } = await this.commandBus.execute<
            CreateTaskCommand,
            { id: string }
        >(
            new CreateTaskCommand({
                title: task.title,
                description: task.description,
                deadline: task.deadline,
                assigneeEmployeeId,
                direction: 'shop',
            }),
        );

        for (const link of task.links) {
            await this.commandBus.execute(
                new AddTaskLinkCommand({
                    taskId,
                    url: link.url,
                    label: link.label,
                }),
            );
        }

        config.taskIdByPeriod[config.accountingPeriod] = taskId;
    }
}
