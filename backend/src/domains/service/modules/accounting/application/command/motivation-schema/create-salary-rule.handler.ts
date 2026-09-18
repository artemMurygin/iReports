import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import type { TaskCompletionSalaryConfigRequest } from 'ireports-contracts';
import { CreateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/create-salary-rule.command';
import type { SalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '../../ports/motivation-schema/salary-rule.port';
import type { MotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '../../ports/motivation-schema/motivation-schema.port';
import { SalaryRuleFactory } from '@/domains/service/modules/accounting/domain/factories/salary-rule.factory';
import { NotFoundException, ArgumentInvalidException } from '@/shared/exceptions';
import { TaskCompletionRequiresPersonalSchemaException } from '@/domains/service/modules/accounting/domain/exceptions/motivation-schema.exception';
import type { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import type { TaskCompletionSalaryConfig } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { computeDeadlineForPeriod } from '@/domains/service/modules/accounting/application/services/task-completion/ensure-rule-task-for-period.service';
import { CreateTaskCommand } from '@/modules/tasks/application/command/create-task/create-task.command';
import { AddTaskLinkCommand } from '@/modules/tasks/application/command/add-task-link/add-task-link.command';

// Создание одного зарплатного правила — общая точка и для
// CreateMotivationSchemaHandler (новая схема), и для
// UpdateMotivationSchemaHandler (полная замена набора правил при PATCH, см.
// WHY там).
//
// split-task-completion-rule-form — правило TaskCompletion снова создаёт задачу здесь, в отличие от
// прежнего (replace-bitrix-task-integration) поведения, где задача заводилась ОТДЕЛЬНЫМ,
// предшествующим запросом с фронта (`POST /v1/tasks`). Форма создания правила теперь либо
// собирает буквальные поля задачи прямо в себе (разовое правило), либо шаблон для авто-пересоздания
// (регулярное) — в обоих случаях бэкенд сам диспатчит `CreateTaskCommand` (тот же CommandBus-путь
// accounting → tasks, что и у `EnsureRuleTaskForPeriodService`, не приватный «бэкдор») ДО вставки
// правила, и дописывает получившийся `taskId` в уже построенный `config.taskIdByPeriod`
// (см. `createTaskCompletionTask` ниже) — `buildTaskCompletionConfig()`/`TaskCompletion.create()`
// сами задачу не создают, остаются чистыми функциями без IO. Для регулярного правила задача
// текущего периода создаётся только если явно запрошено чекбоксом `createTaskForCurrentPeriod`
// (design.md, ui-design.md «Чекбокс · Задача в текущем периоде») — иначе первая задача появится
// лениво, при наступлении следующего периода, тем же `EnsureRuleTaskForPeriodService`, что и раньше.
// Проверка «только на ЛИЧНУЮ схему сотрудника» (см. resolveTarget ниже) сохраняется без изменений:
// естественный ключ «одна задача на правило за период» (config.taskIdByPeriod) физически допускает
// только ОДНУ задачу на правило, что делает выбор "ответственного" среди сотрудников отдела
// произвольным.
@CommandHandler(CreateSalaryRuleCommand)
export class CreateSalaryRuleHandler implements ICommandHandler<
    CreateSalaryRuleCommand,
    { id: string }
> {
    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        protected readonly salaryRuleRepo: SalaryRuleRepositoryPort,
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        protected readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
        protected readonly commandBus: CommandBus,
    ) {}

    async execute(command: CreateSalaryRuleCommand): Promise<{ id: string }> {
        const rule = SalaryRuleFactory.create(command.rule);

        if (command.rule.type === 'TaskCompletion') {
            const schema = await this.assertPersonalSchema(
                command.motivationSchemaId,
            );
            await this.createTaskCompletionTask(
                rule.config as TaskCompletionSalaryConfig,
                command.rule.config,
                schema,
            );
        }

        await this.salaryRuleRepo.insert(rule, {
            motivationSchemaId: command.motivationSchemaId,
        });
        return { id: rule.id };
    }

    // Продуктовое решение (унаследовано без изменений от предыдущей
    // Bitrix-эры): правило TaskCompletion можно завести только на ЛИЧНУЮ
    // схему (MotivationTarget.isEmployee()) — см. WHY у класса выше.
    // Возвращает саму схему (не void) — createTaskCompletionTask() резолвит
    // из неё assigneeEmployeeId (MotivationTarget.getId()) без второго похода
    // в репозиторий.
    private async assertPersonalSchema(
        motivationSchemaId: string,
    ): Promise<MotivationSchema> {
        const schema =
            await this.motivationSchemaRepo.findById(motivationSchemaId);
        if (!schema) {
            throw new NotFoundException('Мотивационная схема не найдена');
        }
        if (!this.isPersonalSchema(schema)) {
            throw new TaskCompletionRequiresPersonalSchemaException();
        }
        return schema;
    }

    private isPersonalSchema(schema: MotivationSchema): boolean {
        return schema.getProps().target.isEmployee();
    }

    // Создаёт задачу через CommandBus и дописывает её id в config.taskIdByPeriod ТЕКУЩЕГО периода
    // (config.accountingPeriod) — мутация того же объекта, что и props.config сущности (тот же
    // приём, что уже использует EnsureRuleTaskForPeriodService.ensure()), поэтому rule.config
    // остаётся согласованным перед salaryRuleRepo.insert() ниже.
    private async createTaskCompletionTask(
        config: TaskCompletionSalaryConfig,
        request: TaskCompletionSalaryConfigRequest,
        schema: MotivationSchema,
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

        // Чекбокс «Создать задачу в текущем периоде» — default true в контракте (то же поведение,
        // что действовало раньше неявно). Снят — регулярное правило создаётся без задачи вовсе,
        // первая появится позже лениво, при наступлении следующего периода
        // (EnsureRuleTaskForPeriodService, вызывается из отчётов).
        if (request.createTaskForCurrentPeriod === false) {
            return;
        }

        await this.createAndAttachTask(config, assigneeEmployeeId, {
            title: request.taskTitleTemplate,
            description: request.taskDescriptionTemplate,
            deadline: computeDeadlineForPeriod(
                request.deadlineTemplate,
                request.deadlinePeriodOffset ?? 0,
                config.accountingPeriod,
            ),
            links: request.taskLinkTemplates ?? [],
        });
    }

    private async createAndAttachTask(
        config: TaskCompletionSalaryConfig,
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
                direction: 'service',
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
