import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateShopMotivationSchemaCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/update-motivation-schema.command';
import { CreateShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/create-salary-rule.command';
import { NotFoundException } from '@/shared/exceptions';
import type { ShopMotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '../../ports/motivation-schema/motivation-schema.port';
import type { ShopSalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '../../ports/motivation-schema/salary-rule.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { ShopMotivationResponse } from 'ireports-contracts';
import { CancelTaskForRuleDeletionService } from '@/modules/tasks/application/services/cancel-task-for-rule-deletion.service';
import { ShopSalaryRuleFactory } from '@/domains/shop/modules/accounting/domain/factories/salary-rule.factory';
import { TaskCompletionShop } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import type {
    CreateShopSalaryRuleProps,
    ShopSalaryRule,
    TaskCompletionShopSalaryConfig,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

// Зеркало domains/service/modules/accounting/application/command/
// update-motivation-schema.handler.ts (issue #57) — независимая копия для
// направления shop.
@CommandHandler(UpdateShopMotivationSchemaCommand)
export class UpdateShopMotivationSchemaHandler implements ICommandHandler<
    UpdateShopMotivationSchemaCommand,
    ShopMotivationResponse
> {
    constructor(
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        protected readonly shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        protected readonly shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort,
        @Inject(UNIT_OF_WORK)
        protected readonly unitOfWork: UnitOfWorkPort,
        protected readonly commandBus: CommandBus,
        // openspec/changes/replace-bitrix-task-integration, design.md
        // решение 3/5 — сквозной сервис src/modules/tasks (не Bitrix
        // gateway): переводит незавершённую задачу в CLOSED_UNSUCCESSFULLY
        // по уже известному taskId, no-op на терминальной.
        protected readonly cancelTaskForRuleDeletion: CancelTaskForRuleDeletionService,
    ) {}

    async execute(
        command: UpdateShopMotivationSchemaCommand,
    ): Promise<ShopMotivationResponse> {
        // Переименование + замена набора правил направления shop должны
        // быть атомарны (см. apiDesign плана: "rename + replace all rules of
        // THIS direction"), поэтому весь сценарий — find → rename → diff по
        // id → close/delete removed → update kept → create new — идёт
        // внутри одной транзакции, тем же приёмом, что и
        // CreateShopMotivationSchemaHandler.
        const motivationSchemaId = await this.unitOfWork.run(async () => {
            const schema = await this.shopMotivationSchemaRepo.findById(
                command.motivationSchemaId,
            );

            // Строки нет ИЛИ у неё 0 правил direction='shop' — та же
            // 404-семантика, что и у GetShopMotivationSchemaService (см.
            // apiDesign плана).
            if (!schema || schema.getProps().rules.length === 0) {
                throw new NotFoundException('Мотивационная схема не найдена');
            }

            schema.rename(command.name);
            await this.shopMotivationSchemaRepo.update(schema);

            // Diff старого набора правил с новым по id, а не полная замена
            // ("delete-all + recreate-all") — зеркало
            // UpdateMotivationSchemaHandler направления service: правило из
            // payload с id, совпадающим со старым правилом, — это ТО ЖЕ
            // правило, отредактированное на месте, а не новое взамен
            // удалённого. Без этого различения TaskCompletion терял бы
            // привязку к своим задачам при КАЖДОМ PATCH схемы, даже если
            // само правило не менялось.
            const oldRules = schema.getProps().rules;
            const oldRulesById = new Map(
                oldRules.map((rule) => [rule.id, rule]),
            );

            const keptRules: {
                id: string;
                rule: CreateShopSalaryRuleProps;
                oldRule: ShopSalaryRule;
            }[] = [];
            const newRules: CreateShopSalaryRuleProps[] = [];
            for (const rule of command.rules) {
                const oldRule = rule.id ? oldRulesById.get(rule.id) : undefined;
                // Совпадение id недостаточно — тип должен остаться прежним
                // (зеркало UpdateMotivationSchemaHandler направления
                // service). Смена типа существующего правила — не
                // редактирование того же правила, а фактическая замена:
                // старое (с его задачами, если это был TaskCompletion)
                // должно отмениться, новое — создаться заново обычным
                // путём.
                if (oldRule && oldRule.type === rule.type) {
                    keptRules.push({ id: rule.id as string, rule, oldRule });
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
            // старых правил, как было раньше.
            await this.cancelTaskCompletionTasks(removedRules);

            // direction='shop' зафиксирован внутри репозитория — правила
            // направления service той же строки motivation_schemas
            // (сотрудник с идентичностями в обеих ERP) не затрагиваются.
            await this.shopSalaryRuleRepo.deleteByIds(
                removedRules.map((rule) => rule.id),
            );

            // Правила, сохранившиеся между PATCH (совпали по id), — их id
            // не меняется, поэтому у TaskCompletion остаётся привязанной та
            // же карта taskIdByPeriod; персистится только новое содержимое
            // правила (название/роль/config). TaskCompletion — особый
            // случай: config запроса несёт taskId (текущего периода), а не
            // taskIdByPeriod (design.md решение 4) — TaskCompletionShop.
            // restore() сливает его с УЖЕ существующей картой прежних
            // периодов, generic ShopSalaryRuleFactory.restore() этого не
            // делает (config запроса и домена совпадают только у остальных
            // типов правил).
            for (const { id, rule, oldRule } of keptRules) {
                const entity =
                    rule.type === 'TaskCompletion'
                        ? TaskCompletionShop.restore(
                              id,
                              rule,
                              oldRule as TaskCompletionShop,
                          )
                        : ShopSalaryRuleFactory.restore(id, rule);
                await this.shopSalaryRuleRepo.update(entity);
            }

            // Новые правила (без id в payload или с id, не найденным в
            // старом наборе) создаются через тот же CreateShopSalaryRuleCommand,
            // что и CreateShopMotivationSchemaHandler — код создания
            // правила не дублируется.
            for (const rule of newRules) {
                await this.commandBus.execute(
                    new CreateShopSalaryRuleCommand({
                        motivationSchemaId: schema.id,
                        rule,
                    }),
                );
            }

            return schema.id;
        });

        return { id: motivationSchemaId };
    }

    // openspec/changes/replace-bitrix-task-integration, design.md решение
    // 3/5 — переводит КАЖДУЮ ещё не терминальную задачу удаляемого
    // TaskCompletion-правила в CLOSED_UNSUCCESSFULLY ДО удаления записи
    // правила. Разовое правило несёт ровно один taskId в taskIdByPeriod,
    // регулярное — по одному на каждый прошедший период; cancel() сам
    // no-op на уже терминальной/несуществующей задаче (см. WHY в
    // CancelTaskForRuleDeletionService, src/modules/tasks) — этому хендлеру
    // не нужно проверять статус самому.
    private async cancelTaskCompletionTasks(
        rules: ShopSalaryRule[],
    ): Promise<void> {
        const taskCompletionRules = rules.filter(
            (rule) => rule.type === 'TaskCompletion',
        );

        for (const rule of taskCompletionRules) {
            const config = rule.config as TaskCompletionShopSalaryConfig;
            for (const taskId of Object.values(config.taskIdByPeriod)) {
                await this.cancelTaskForRuleDeletion.cancel(taskId);
            }
        }
    }
}
