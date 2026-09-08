import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { UpdateMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/update-motivation-schema.command';
import { CreateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/create-salary-rule.command';
import { NotFoundException } from '@/shared/exceptions';
import type { MotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '../../ports/motivation-schema/motivation-schema.port';
import type { SalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '../../ports/motivation-schema/salary-rule.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { MotivationResponse } from 'ireports-contracts';
import { CancelTaskForRuleDeletionService } from '@/modules/tasks/application/services/cancel-task-for-rule-deletion.service';
import { SalaryRuleFactory } from '@/domains/service/modules/accounting/domain/factories/salary-rule.factory';
import { buildTaskCompletionConfig } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import type {
    CreateSalaryRuleProps,
    SalaryRule,
    TaskCompletionSalaryConfig,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

@CommandHandler(UpdateMotivationSchemaCommand)
export class UpdateMotivationSchemaHandler implements ICommandHandler<
    UpdateMotivationSchemaCommand,
    MotivationResponse
> {
    private readonly logger = new Logger(UpdateMotivationSchemaHandler.name);

    constructor(
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        protected readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
        @Inject(SALARY_RULE_REPOSITORY)
        protected readonly salaryRuleRepo: SalaryRuleRepositoryPort,
        @Inject(UNIT_OF_WORK)
        protected readonly unitOfWork: UnitOfWorkPort,
        protected readonly commandBus: CommandBus,
        protected readonly cancelTaskForRuleDeletion: CancelTaskForRuleDeletionService,
    ) {}

    async execute(
        command: UpdateMotivationSchemaCommand,
    ): Promise<MotivationResponse> {
        // Переименование + замена набора правил направления service должны
        // быть атомарны (см. apiDesign плана: "rename + replace all rules of
        // THIS direction"), поэтому весь сценарий — find → rename → diff по
        // id → cancel/delete removed → update kept → create new — идёт
        // внутри одной транзакции, тем же приёмом, что и
        // CreateMotivationSchemaHandler.
        const motivationSchemaId = await this.unitOfWork.run(async () => {
            const schema = await this.motivationSchemaRepo.findById(
                command.motivationSchemaId,
            );

            // Строки нет ИЛИ у неё 0 правил direction='service' — та же
            // 404-семантика, что и у GetMotivationSchemaService (см.
            // apiDesign плана).
            if (!schema || schema.getProps().rules.length === 0) {
                throw new NotFoundException('Мотивационная схема не найдена');
            }

            schema.rename(command.name);
            await this.motivationSchemaRepo.update(schema);

            // Diff старого набора правил (schema.getProps().rules) с новым
            // (command.rules) по id, а не полная замена ("delete-all +
            // recreate-all"): правило из payload с id, совпадающим со старым
            // правилом, — это ТО ЖЕ правило, отредактированное на месте, а
            // не новое взамен удалённого. Без этого различения TaskCompletion
            // терял бы привязанную задачу (отменялась и создавалась заново)
            // при КАЖДОМ PATCH схемы, даже если само правило не менялось.
            const oldRules = schema.getProps().rules;
            const oldRulesById = new Map(
                oldRules.map((rule) => [rule.id, rule]),
            );

            const keptRules: { id: string; rule: CreateSalaryRuleProps }[] = [];
            const newRules: CreateSalaryRuleProps[] = [];
            for (const rule of command.rules) {
                const oldRule = rule.id ? oldRulesById.get(rule.id) : undefined;
                // Совпадение id недостаточно — тип должен остаться прежним.
                // Смена типа существующего правила (например, TaskCompletion
                // → PayPerHour) — не редактирование того же правила, а
                // фактическая замена: старое (с его задачей, если это был
                // TaskCompletion) должно отмениться, новое — создаться
                // заново обычным путём.
                if (oldRule && oldRule.type === rule.type) {
                    keptRules.push({ id: rule.id as string, rule });
                } else {
                    newRules.push(rule);
                }
            }

            const keptRuleIds = new Set(keptRules.map((kept) => kept.id));
            const removedRules = oldRules.filter(
                (rule) => !keptRuleIds.has(rule.id),
            );

            // Задачи отменяются ТОЛЬКО у правил TaskCompletion, реально
            // отсутствующих в новом наборе (removedRules) — не у всех
            // старых правил.
            await this.cancelTaskCompletionTasks(removedRules);

            // direction='service' зафиксирован внутри репозитория — правила
            // направления shop той же строки motivation_schemas (сотрудник с
            // идентичностями в обеих ERP) не затрагиваются.
            await this.salaryRuleRepo.deleteByIds(
                removedRules.map((rule) => rule.id),
            );

            // Правила, сохранившиеся между PATCH (совпали по id), — их id
            // не меняется, поэтому у TaskCompletion остаётся привязанная та
            // же задача; персистится только новое содержимое правила
            // (название/роль/config). Для TaskCompletion config запроса
            // (config.taskId — одноразовый вход, относится только к
            // ТЕКУЩЕМУ периоду, design.md решение 4) СНАЧАЛА мержится со
            // старым taskIdByPeriod правила (mergeTaskCompletionConfig) —
            // иначе PATCH стёр бы привязку задач прошлых периодов
            // регулярного правила.
            for (const { id, rule } of keptRules) {
                const entity = SalaryRuleFactory.restore(
                    id,
                    this.mergeTaskCompletionConfig(rule, oldRulesById.get(id)),
                );
                await this.salaryRuleRepo.update(entity);
            }

            // Новые правила (без id в payload или с id, не найденным в
            // старом наборе) создаются через тот же CreateSalaryRuleCommand,
            // что и CreateMotivationSchemaHandler — код создания правила не
            // дублируется.
            for (const rule of newRules) {
                await this.commandBus.execute(
                    new CreateSalaryRuleCommand({
                        motivationSchemaId: schema.id,
                        rule,
                    }),
                );
            }

            return schema.id;
        });

        return { id: motivationSchemaId };
    }

    // design.md решение 4 — taskId запроса относится ТОЛЬКО к ТЕКУЩЕМУ
    // периоду (тот же readonly-виджет уже созданной задачи, что и на шаге 1
    // мастера); при правке уже существующего правила эта единственная пара
    // period→taskId ОБЪЕДИНЯЕТСЯ со старой картой правила, а не заменяет её
    // целиком — иначе PATCH регулярного правила стирал бы привязку задач
    // прошлых периодов.
    private mergeTaskCompletionConfig(
        rule: CreateSalaryRuleProps,
        oldRule?: SalaryRule,
    ): CreateSalaryRuleProps {
        if (rule.type !== 'TaskCompletion') {
            return rule;
        }
        const oldConfig = oldRule?.config as
            TaskCompletionSalaryConfig | undefined;
        // SalaryRuleFactory.restore() передаёт rule.config дальше БЕЗ
        // трансформации (см. WHY там) — сюда намеренно кладётся уже
        // домен-формы config (taskIdByPeriod), а не request-формы
        // (TaskCompletionSalaryConfigRequest, с taskId), поэтому
        // возвращаемое значение структурно не совпадает с
        // CreateSalaryRuleProps (request-типом из contracts) — приведение
        // типа оправдано тем же способом, что и сам restore().
        return {
            ...rule,
            config: buildTaskCompletionConfig(
                rule.config,
                oldConfig?.taskIdByPeriod,
            ),
        } as unknown as CreateSalaryRuleProps;
    }

    // replace-bitrix-task-integration, design.md решение 3 «Отмена при
    // удалении правила» — незавершённая задача переводится в «Закрыта
    // неуспешно» (CancelTaskForRuleDeletionService.cancel(), уже no-op на
    // терминальном статусе); сбой отмены НЕ блокирует удаление правила
    // (техническая ошибка не должна останавливать локальную операцию,
    // логируется для ручной сверки). Регулярное правило может нести
    // несколько taskId (по одному на период, config.taskIdByPeriod) —
    // отменяются ВСЕ, не только текущего периода.
    private async cancelTaskCompletionTasks(
        rules: SalaryRule[],
    ): Promise<void> {
        const taskCompletionRules = rules.filter(
            (rule) => rule.type === 'TaskCompletion',
        );

        for (const rule of taskCompletionRules) {
            const config = rule.config as TaskCompletionSalaryConfig;
            const taskIds = Object.values(config.taskIdByPeriod);
            for (const taskId of taskIds) {
                try {
                    await this.cancelTaskForRuleDeletion.cancel(taskId);
                } catch (error) {
                    this.logger.error(
                        `Не удалось отменить задачу ${taskId} (правило ` +
                            `TaskCompletion ${rule.id}) при удалении правила`,
                        error instanceof Error ? error.stack : String(error),
                    );
                }
            }
        }
    }
}
