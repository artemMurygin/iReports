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
import { BITRIX_TASKS_GATEWAY } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import type { BitrixTasksGatewayPort } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import { SALARY_TASK_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-task/salary-task.port';
import type { SalaryTaskRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-task/salary-task.port';
import { SalaryRuleFactory } from '@/domains/service/modules/accounting/domain/factories/salary-rule.factory';
import type {
    CreateSalaryRuleProps,
    SalaryRule,
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
        @Inject(BITRIX_TASKS_GATEWAY)
        protected readonly tasksGateway: BitrixTasksGatewayPort,
        @Inject(SALARY_TASK_REPOSITORY)
        protected readonly salaryTaskRepo: SalaryTaskRepositoryPort,
    ) {}

    async execute(
        command: UpdateMotivationSchemaCommand,
    ): Promise<MotivationResponse> {
        // Переименование + замена набора правил направления service должны
        // быть атомарны (см. apiDesign плана: "rename + replace all rules of
        // THIS direction"), поэтому весь сценарий — find → rename → diff по
        // id → close/delete removed → update kept → create new — идёт
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
            // терял бы привязанную задачу Bitrix24 (закрывалась и
            // пересоздавалась заново) при КАЖДОМ PATCH схемы, даже если само
            // правило не менялось — см. design.md Decision 6
            // (add-task-based-salary-rule) и Requirement «Двусторонняя
            // синхронизация данных задачи» specs/integrations/bitrix-tasks.
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
                // фактическая замена: старое (с его задачей Bitrix24, если
                // это был TaskCompletion) должно закрыться, новое —
                // создаться заново обычным путём.
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

            // Задачи Bitrix24 закрываются ТОЛЬКО у правил TaskCompletion,
            // реально отсутствующих в новом наборе (removedRules) — не у
            // всех старых правил, как было раньше.
            await this.closeTaskCompletionTasks(removedRules);

            // direction='service' зафиксирован внутри репозитория — правила
            // направления shop той же строки motivation_schemas (сотрудник с
            // идентичностями в обеих ERP) не затрагиваются.
            await this.salaryRuleRepo.deleteByIds(
                removedRules.map((rule) => rule.id),
            );

            // Правила, сохранившиеся между PATCH (совпали по id), — их id
            // не меняется, поэтому у TaskCompletion остаётся привязанной та
            // же SalaryTask/задача Bitrix24; персистится только новое
            // содержимое правила (название/роль/config).
            for (const { id, rule } of keptRules) {
                const entity = SalaryRuleFactory.restore(id, rule);
                await this.salaryRuleRepo.update(entity);
            }

            // Новые правила (без id в payload или с id, не найденным в
            // старом наборе) создаются через тот же CreateSalaryRuleCommand,
            // что и CreateMotivationSchemaHandler — код создания правила
            // (включая ветку TaskCompletion — создание задачи Bitrix24) не
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

    // design.md Decision 6 — «закрывается задача в Bitrix24, затем
    // удаляется запись»; сбой Bitrix24 НЕ блокирует удаление правила
    // (внешняя система, недоступность которой не должна останавливать
    // локальную операцию) — расхождение («правила нет — задача в Bitrix24
    // всё ещё открыта») обнаруживает ближайший цикл SalaryTaskStatusSyncCron
    // (раздел 8). findActiveByRule — ВСЕ ещё не завершённые задачи правила
    // вне зависимости от периода (разовое правило может быть удалено в
    // периоде, отличном от периода создания его единственной задачи).
    private async closeTaskCompletionTasks(rules: SalaryRule[]): Promise<void> {
        const taskCompletionRules = rules.filter(
            (rule) => rule.type === 'TaskCompletion',
        );

        for (const rule of taskCompletionRules) {
            const activeTasks = await this.salaryTaskRepo.findActiveByRule(
                rule.id,
            );
            for (const task of activeTasks) {
                try {
                    await this.tasksGateway.closeTask(task.bitrixTaskId);
                } catch (error) {
                    this.logger.error(
                        `Не удалось закрыть задачу Bitrix24 ${task.bitrixTaskId} ` +
                            `(правило TaskCompletion ${rule.id}) при удалении правила — ` +
                            'расхождение обнаружит крон синхронизации статуса',
                        error instanceof Error ? error.stack : String(error),
                    );
                }
            }
        }
    }
}
