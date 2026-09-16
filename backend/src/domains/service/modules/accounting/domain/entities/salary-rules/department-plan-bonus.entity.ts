import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateSalaryRuleProps,
    DepartmentPlanBonusSalaryConfig,
    DepartmentPlanBonusSalaryRule,
    SalaryRule,
    TargetRole,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { ServiceCalculationContext } from '@/domains/service/modules/accounting/domain/types/calculation-context.types';
import type { DepartmentSalesPerformanceEntry } from '@/domains/service/modules/accounting/domain/types/calculation-context.types';
import { departmentPerformanceOverrideScopeKey } from '@/domains/service/modules/accounting/domain/types/calculation-context.types';
import { roundRubles } from '@/domains/service/modules/accounting/domain/services/money';
import { resolveFloatPercentMultiplier } from '@/domains/service/modules/accounting/domain/services/float-percent';

// Implements FR3 of add-department-head-salary-rules.
//
// Правило уровня отдела/направления «фиксированная сумма × плавающий коэффициент выполнения плана»
// (design.md Decision 2) — не итерирует транзакции, не матчит роль по заказу, всегда считается
// целиком на того единственного сотрудника, кому назначена мотивационная схема (targetType =
// 'Employee'). Переиспользует уже существующий resolveFloatPercentMultiplier (тот же алгоритм, что
// использует OrderPayedEntity award.type === 'FloatPercent') без изменения формулы.
export class DepartmentPlanBonusEntity
    extends Entity<DepartmentPlanBonusSalaryRule>
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

    get config(): DepartmentPlanBonusSalaryConfig {
        return this.props.config;
    }

    get isActive(): boolean {
        return this.props.isActive;
    }

    static create(rule: CreateSalaryRuleProps): DepartmentPlanBonusEntity {
        return new DepartmentPlanBonusEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'DepartmentPlanBonus',
                targetRole: rule.targetRole,
                config: rule.config as DepartmentPlanBonusSalaryConfig,
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
     * Implements FR3 of add-department-head-salary-rules.
     *
     * amount = round(fixedAmount * resolveFloatPercentMultiplier(percentBorders, percentCompletion)),
     * где percentCompletion резолвится по СОБСТВЕННОЙ category правила (design.md Decision 1), не по
     * отделу целиком. Если для этого scope нет SalesPerformance — начисляет 0, а не бросает ошибку
     * (design.md Q2, в отличие от FloatPercent у OrderPayedEntity).
     */
    calculate(context: ServiceCalculationContext): CalculationLine {
        const entry = this.resolveEntry(context);

        if (!entry) {
            return this.emptyLine();
        }

        const multiplier = resolveFloatPercentMultiplier(
            this.config.percentBorders,
            entry.percentCompletion,
        );
        const amount = roundRubles(this.config.fixedAmount * multiplier);

        return {
            ruleId: this.id,
            salaryBasis: this.config.salaryBasis,
            rate: this.config.fixedAmount * multiplier,
            amount,
            sources: [],
        };
    }

    validate(): void {}

    // Временный костыль (см. WHY у DepartmentPlanBonusSalaryConfig.departmentId) — если правило явно
    // переопределило отдел, читаем его факт из departmentPerformanceOverrides (ключ включает
    // departmentId, не зависит от отдела сотрудника), иначе — прежнее поведение: собственный отдел
    // сотрудника через departmentSalesPerformance.
    private resolveEntry(
        context: ServiceCalculationContext,
    ): DepartmentSalesPerformanceEntry | null {
        if (this.config.departmentId != null) {
            const key = departmentPerformanceOverrideScopeKey({
                departmentId: this.config.departmentId,
                category: this.config.category,
            });
            return context.departmentPerformanceOverrides.get(key) ?? null;
        }
        return context.departmentSalesPerformance?.get(this.config.category) ?? null;
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
