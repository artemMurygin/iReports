import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateShopSalaryRuleProps,
    ShopSalaryRule,
    TargetRole,
    TaskCompletionShopSalaryConfig,
    TaskCompletionShopSalaryRule,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import type { ShopCalculationContext } from '@/domains/shop/modules/accounting/domain/types/calculation-context.types';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';
import { buildBitrixTaskLink } from '@/integrations/bitrix/bitrix-task-link-builder';

// Раздел 15 tasks.md (add-task-based-salary-rule) — зеркало TaskCompletion
// сервиса (domains/service/modules/accounting/domain/entities/salary-rules/
// task-completion.entity.ts, раздел 10), независимая копия для направления
// shop (issue #57 — не переиспользуется ни один класс сервиса).
//
// spec: shop/accounting#requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения
//
// В отличие от остальных типов правил магазина (ProductSold/
// UsedProductSold/PayPerHour), TaskCompletionShop не матчит сотрудника по
// полям ERP-данных — правило целиком привязано к ОДНОМУ конкретному
// сотруднику через его мотивационную схему (targetRole здесь — только
// значение каталога/формы, см. salary-rule-role-catalog.ts), поэтому
// calculate() не фильтрует erpData по роли, а лишь смотрит статус СВОЕЙ
// связанной задачи по ключу this.id в erpData.taskCompletionStatuses
// (заполняется BuildShopCalculationContextService, раздел 17, через
// ShopSalaryTaskRepository.findByRuleAndPeriod).
export class TaskCompletionShop
    extends Entity<TaskCompletionShopSalaryRule>
    implements ShopSalaryRule
{
    declare protected _id: AggregateID;

    get name(): string {
        return this.props.name;
    }

    get type(): string {
        return this.props.type;
    }

    get targetRole(): TargetRole {
        return this.props.targetRole;
    }

    get config(): TaskCompletionShopSalaryConfig {
        return this.props.config;
    }

    static create(rule: CreateShopSalaryRuleProps): TaskCompletionShop {
        return new TaskCompletionShop({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'TaskCompletion',
                targetRole: rule.targetRole,
                config: rule.config as TaskCompletionShopSalaryConfig,
            },
        });
    }

    // spec: shop/accounting#requirement-сумма-начисления-по-правилу-за-выполнение-задачи-задаётся-руководителем-вручную
    //
    // null, пока связанная задача Bitrix24 не переведена в статус
    // «Завершена» (design.md Decision 3 — статус приходит из локально
    // синхронизированного SalaryTaskStatusSyncCron, а не запросом к
    // Bitrix24 из самого правила, см. backend/CLAUDE.md — domain не имеет
    // доступа к IO). Когда статус Done — amount ВСЕГДА равен
    // config.defaultAmount (сумма по умолчанию, заданная при создании
    // правила), requiresManualInput ВСЕГДА true — руководитель по-прежнему
    // обязан явно подтвердить/изменить сумму и указать комментарий при
    // проведении: действующая сумма живёт только на ShopSalaryAccrualLine
    // (design.md Decision 5), calculate() её не читает и не пересчитывает.
    calculate(context: ShopCalculationContext): CalculationLine | null {
        const erpData = context.erpData as ShopCalculationErpData | undefined;
        const taskStatus = erpData?.taskCompletionStatuses?.[this.id];

        if (!taskStatus || !taskStatus.status.isDone()) {
            return null;
        }

        return {
            ruleId: this.id,
            amount: this.props.config.defaultAmount,
            requiresManualInput: true,
            sources: this.buildSources(taskStatus.bitrixTaskId),
        };
    }

    // spec: shop/accounting#requirement-детализация-строки-задача-и-ссылка-на-неё
    //
    // Единственный источник строки — сама связанная задача (design.md
    // Decision 7): label берётся из config.bitrixTaskTitle правила (то же
    // название, что уже отправлено в Bitrix24 при создании задачи, без
    // отдельного round-trip в ERP за названием), ссылка — общим
    // (направление-агностичным) хелпером buildBitrixTaskLink.
    private buildSources(bitrixTaskId: string) {
        return [
            {
                type: 'taskCompletion',
                id: bitrixTaskId,
                label: this.props.config.bitrixTaskTitle,
                link: buildBitrixTaskLink(bitrixTaskId),
            },
        ];
    }

    validate(): void {}
}
