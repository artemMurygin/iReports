import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateShopSalaryRuleProps,
    DepartmentPercentShopSalaryConfig,
    DepartmentPercentShopSalaryRule,
    ShopSalaryRule,
    TargetRole,
} from '../../types/salary-rule.types';
import type {
    DepartmentSalesPerformanceEntry,
    ShopDepartmentCalculationContext,
} from '../../types/calculation-context.types';
import { departmentPerformanceOverrideScopeKey } from '../../types/calculation-context.types';
import { Money } from '../../value-objects/money.value-object';

// Implements FR2 of add-department-head-salary-rules.
//
// Зеркало domains/service/modules/accounting/domain/entities/salary-rules/department-percent.entity.ts
// (design.md Decision 5 — независимая реализация в домене shop). Правило уровня отдела/направления
// «процент от факта» — не итерирует транзакции (позиции отгрузок) и не матчит роль сотрудника по
// отгрузке (role-source.ts здесь не используется): считается целиком на того единственного
// сотрудника, кому назначена мотивационная схема (targetType = 'Employee'). targetRole сохраняется
// на правиле только ради консистентности схемы/каталога ролей UI.
export class DepartmentPercentEntity
    extends Entity<DepartmentPercentShopSalaryRule>
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

    get config(): DepartmentPercentShopSalaryConfig {
        return this.props.config;
    }

    get isActive(): boolean {
        return this.props.isActive;
    }

    static create(rule: CreateShopSalaryRuleProps): DepartmentPercentEntity {
        return new DepartmentPercentEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'DepartmentPercent',
                targetRole: rule.targetRole,
                config: rule.config as DepartmentPercentShopSalaryConfig,
                isActive: true,
            },
        });
    }

    // Soft-деактивация/реактивация (см. isActive у ShopSalaryRule) — прямая
    // мутация props.
    deactivate(): void {
        this.props.isActive = false;
    }

    activate(): void {
        this.props.isActive = true;
    }

    /**
     * Implements FR2 of add-department-head-salary-rules.
     *
     * amount = round(fact.(turnover|margin для config.category) * percent / 100) — без какого-либо
     * коэффициента. Фактическое значение резолвится по СОБСТВЕННОЙ category правила — по аналогии с
     * ProductSoldEntity, а не по магазину целиком. Если для этого scope нет SalesPerformance —
     * начисляет 0, а не бросает ошибку (design.md Q2).
     */
    calculate(context: ShopDepartmentCalculationContext): CalculationLine {
        const entry = this.resolveEntry(context);

        if (!entry) {
            return this.emptyLine();
        }

        const base =
            this.config.salaryBasis === 'REVENUE'
                ? entry.fact.turnover
                : entry.fact.margin;
        const amount = Money.roundRubles(
            (base * this.config.percent) / 100,
        ).getValue();

        return {
            ruleId: this.id,
            salaryBasis: this.config.salaryBasis,
            rate: this.config.percent,
            amount,
            sources: [],
        };
    }

    validate(): void {}

    private emptyLine(): CalculationLine {
        return {
            ruleId: this.id,
            salaryBasis: this.config.salaryBasis,
            rate: this.config.percent,
            amount: 0,
            sources: [],
        };
    }

    // Временный костыль (см. WHY у DepartmentPercentShopSalaryConfig.departmentId) — если правило
    // явно переопределило отдел, читаем его факт из departmentPerformanceOverrides (ключ включает
    // departmentId, не зависит от отдела сотрудника), иначе — прежнее поведение: собственный отдел
    // сотрудника через departmentSalesPerformance.
    private resolveEntry(
        context: ShopDepartmentCalculationContext,
    ): DepartmentSalesPerformanceEntry | null {
        if (this.config.departmentId != null) {
            const key = departmentPerformanceOverrideScopeKey({
                departmentId: this.config.departmentId,
                category: this.config.category,
            });
            return context.departmentPerformanceOverrides.get(key) ?? null;
        }
        return (
            context.departmentSalesPerformance?.get(this.config.category) ??
            null
        );
    }
}
