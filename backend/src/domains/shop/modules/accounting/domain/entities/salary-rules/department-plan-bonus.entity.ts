import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateShopSalaryRuleProps,
    DepartmentPlanBonusShopSalaryConfig,
    DepartmentPlanBonusShopSalaryRule,
    ShopSalaryRule,
    TargetRole,
} from '../../types/salary-rule.types';
import type { ShopDepartmentCalculationContext } from '../../types/calculation-context.types';
import { Money } from '../../value-objects/money.value-object';
import { FloatPercentSchedule } from '../../value-objects/float-percent-schedule.value-object';

// Implements FR3 of add-department-head-salary-rules.
//
// Зеркало domains/service/modules/accounting/domain/entities/salary-rules/department-plan-bonus.entity.ts
// (design.md Decision 5 — независимая реализация в домене shop). Не итерирует транзакции, не матчит
// роль по отгрузке, считается целиком на того единственного сотрудника, кому назначена мотивационная
// схема. Переиспользует уже существующий FloatPercentSchedule (тот же алгоритм, что использует
// ProductSoldEntity award.type === 'FloatPercent') без изменения формулы.
export class DepartmentPlanBonusEntity
    extends Entity<DepartmentPlanBonusShopSalaryRule>
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

    get config(): DepartmentPlanBonusShopSalaryConfig {
        return this.props.config;
    }

    static create(rule: CreateShopSalaryRuleProps): DepartmentPlanBonusEntity {
        return new DepartmentPlanBonusEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'DepartmentPlanBonus',
                targetRole: rule.targetRole,
                config: rule.config as DepartmentPlanBonusShopSalaryConfig,
            },
        });
    }

    /**
     * Implements FR3 of add-department-head-salary-rules.
     *
     * amount = round(fixedAmount * FloatPercentSchedule.resolveMultiplier(percentCompletion)), где
     * percentCompletion резолвится по СОБСТВЕННОЙ category правила, не по магазину целиком. Если для
     * этого scope нет SalesPerformance — начисляет 0, а не бросает ошибку (design.md Q2).
     */
    calculate(context: ShopDepartmentCalculationContext): CalculationLine {
        const entry =
            context.departmentSalesPerformance?.get(this.config.category) ??
            null;

        if (!entry) {
            return this.emptyLine();
        }

        const multiplier = FloatPercentSchedule.create(
            this.config.percentBorders,
        ).resolveMultiplier(entry.percentCompletion);
        const amount = Money.roundRubles(
            this.config.fixedAmount * multiplier,
        ).getValue();

        return {
            ruleId: this.id,
            salaryBasis: this.config.salaryBasis,
            rate: this.config.fixedAmount * multiplier,
            amount,
            sources: [],
        };
    }

    // Только FloatPercentSchedule.create() несёт семантические инварианты (порядок/уникальность/
    // диапазон percentBorders) — тот же приём, что ProductSoldEntity (shop) применяет к award.
    validate(): void {
        FloatPercentSchedule.create(this.props.config.percentBorders);
    }

    private emptyLine(): CalculationLine {
        return {
            ruleId: this.id,
            salaryBasis: this.config.salaryBasis,
            rate: 0,
            amount: 0,
            sources: [],
        };
    }
}
