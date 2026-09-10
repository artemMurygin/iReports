import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateShopSalaryRuleProps,
    DepartmentTurnoverBonusShopSalaryConfig,
    DepartmentTurnoverBonusShopSalaryRule,
    ShopSalaryRule,
    TargetRole,
} from '../../types/salary-rule.types';
import {
    turnoverPerformanceScopeKey,
    type ShopDepartmentCalculationContext,
} from '../../types/calculation-context.types';
import { Money } from '../../value-objects/money.value-object';
import { FloatPercentSchedule } from '../../value-objects/float-percent-schedule.value-object';
import { resolveTurnoverPercentCompletion } from '../../services/turnover-percent-completion';

// Implements FR4 of add-department-head-salary-rules.
//
// Зеркало domains/service/modules/accounting/domain/entities/salary-rules/department-turnover-bonus.entity.ts
// (design.md Decision 5 — независимая реализация в домене shop). Привязано к конкретному складу
// МойСклад (warehouseId — строковый UUID, обязательное поле конфигурации): оборачиваемость скоуплена
// по (category, warehouse), а не по отделу, автоматической привязки сотрудник→склад в системе нет.
// planTurnoverRatio хранится прямо в config, не отдельной сущностью плана. Не итерирует транзакции,
// не матчит роль по отгрузке — считается целиком на того единственного сотрудника, кому назначена
// мотивационная схема.
export class DepartmentTurnoverBonusEntity
    extends Entity<DepartmentTurnoverBonusShopSalaryRule>
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

    get config(): DepartmentTurnoverBonusShopSalaryConfig {
        return this.props.config;
    }

    static create(
        rule: CreateShopSalaryRuleProps,
    ): DepartmentTurnoverBonusEntity {
        return new DepartmentTurnoverBonusEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'DepartmentTurnoverBonus',
                targetRole: rule.targetRole,
                config: rule.config as DepartmentTurnoverBonusShopSalaryConfig,
            },
        });
    }

    /**
     * Implements FR4 of add-department-head-salary-rules.
     *
     * amount = round(fixedAmount * FloatPercentSchedule.resolveMultiplier(
     *   resolveTurnoverPercentCompletion(factTurnoverRatio, planTurnoverRatio))), где
     * factTurnoverRatio резолвится по СОБСТВЕННЫМ warehouseId+category правила — при category = null
     * берётся итог по всему складу (см. GoodsTurnoverWarehouseTotal/TurnoverReportSnapshot, FR5).
     * Если для этого scope нет факта оборачиваемости — начисляет 0, а не бросает ошибку (design.md Q2).
     */
    calculate(context: ShopDepartmentCalculationContext): CalculationLine {
        const key = turnoverPerformanceScopeKey({
            warehouseId: this.config.warehouseId,
            category: this.config.category,
        });
        const factRatio = context.turnoverPerformance.get(key) ?? null;

        const percentCompletion = resolveTurnoverPercentCompletion(
            factRatio,
            this.config.planTurnoverRatio,
        );
        if (percentCompletion === null) {
            return this.emptyLine();
        }

        const multiplier = FloatPercentSchedule.create(
            this.config.percentBorders,
        ).resolveMultiplier(percentCompletion);
        const amount = Money.roundRubles(
            this.config.fixedAmount * multiplier,
        ).getValue();

        return {
            ruleId: this.id,
            rate: this.config.fixedAmount * multiplier,
            amount,
            sources: [],
        };
    }

    validate(): void {
        FloatPercentSchedule.create(this.props.config.percentBorders);
    }

    private emptyLine(): CalculationLine {
        return {
            ruleId: this.id,
            rate: 0,
            amount: 0,
            sources: [],
        };
    }
}
