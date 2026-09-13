import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateSalaryRuleProps,
    DepartmentTurnoverBonusSalaryConfig,
    DepartmentTurnoverBonusSalaryRule,
    SalaryRule,
    TargetRole,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import {
    turnoverPerformanceScopeKey,
    type ServiceCalculationContext,
} from '@/domains/service/modules/accounting/domain/types/calculation-context.types';
import { roundRubles } from '@/domains/service/modules/accounting/domain/services/money';
import { resolveFloatPercentMultiplier } from '@/domains/service/modules/accounting/domain/services/float-percent';
import { resolveTurnoverPercentCompletion } from '@/domains/service/modules/accounting/domain/services/turnover-percent-completion';

// Implements FR4 of add-department-head-salary-rules.
//
// Правило уровня отдела/направления «фиксированная сумма × плавающий коэффициент выполнения плана
// по оборачиваемости», привязанное к конкретному СКЛАДУ (design.md Decision 2) — в отличие от
// DepartmentPercent/DepartmentPlanBonus (FR2/FR3), не использует department сотрудника вовсе:
// оборачиваемость скоуплена по (category, warehouse), а не по отделу, поэтому warehouseId —
// обязательное поле конфигурации. planTurnoverRatio хранится прямо в config, не отдельной сущностью
// плана. Не итерирует транзакции, не матчит роль по заказу — считается целиком на того единственного
// сотрудника, кому назначена мотивационная схема.
export class DepartmentTurnoverBonusEntity
    extends Entity<DepartmentTurnoverBonusSalaryRule>
    implements SalaryRule
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

    get config(): DepartmentTurnoverBonusSalaryConfig {
        return this.props.config;
    }

    get isActive(): boolean {
        return this.props.isActive;
    }

    static create(rule: CreateSalaryRuleProps): DepartmentTurnoverBonusEntity {
        return new DepartmentTurnoverBonusEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'DepartmentTurnoverBonus',
                targetRole: rule.targetRole,
                config: rule.config as DepartmentTurnoverBonusSalaryConfig,
                isActive: true,
            },
        });
    }

    // Soft-деактивация/реактивация (см. isActive у SalaryRule) — прямая
    // мутация props, тот же приём, что и MotivationSchema.rename().
    deactivate(): void {
        this.props.isActive = false;
    }

    activate(): void {
        this.props.isActive = true;
    }

    /**
     * Implements FR4 of add-department-head-salary-rules.
     *
     * amount = round(fixedAmount * resolveFloatPercentMultiplier(percentBorders,
     *   resolveTurnoverPercentCompletion(factTurnoverRatio, planTurnoverRatio))), где factTurnoverRatio
     * резолвится по СОБСТВЕННЫМ warehouseId+category правила (design.md Decision 2) — при
     * category = null берётся итог по всему складу (см. GoodsTurnoverWarehouseTotal/
     * TurnoverReportSnapshot, FR5). Если для этого scope нет факта оборачиваемости — начисляет 0,
     * а не бросает ошибку (design.md Q2).
     */
    calculate(context: ServiceCalculationContext): CalculationLine {
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

        const multiplier = resolveFloatPercentMultiplier(
            this.config.percentBorders,
            percentCompletion,
        );
        const amount = roundRubles(this.config.fixedAmount * multiplier);

        return {
            ruleId: this.id,
            rate: this.config.fixedAmount * multiplier,
            amount,
            sources: [],
        };
    }

    validate(): void {}

    private emptyLine(): CalculationLine {
        return {
            ruleId: this.id,
            rate: 0,
            amount: 0,
            sources: [],
        };
    }
}
