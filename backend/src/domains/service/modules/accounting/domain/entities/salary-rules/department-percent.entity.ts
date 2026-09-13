import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { ArgumentInvalidException } from '@/shared/exceptions';
import {
    CreateSalaryRuleProps,
    DepartmentPercentSalaryConfig,
    DepartmentPercentSalaryRule,
    SalaryBasis,
    SalaryRule,
    TargetRole,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { ServiceCalculationContext } from '@/domains/service/modules/accounting/domain/types/calculation-context.types';
import { roundRubles } from '@/domains/service/modules/accounting/domain/services/money';

// Implements FR2 of add-department-head-salary-rules.
//
// Правило уровня отдела/направления «процент от факта» (design.md Decision 2) — в отличие от
// PayPerHour/ServiceCompleted/OrderPayed/TaskCompletion, НЕ итерирует транзакции (заказы/задачи/часы)
// и не матчит роль сотрудника по заказу (role-source.ts здесь не используется): считается целиком на
// того единственного сотрудника, кому назначена мотивационная схема (targetType = 'Employee').
// targetRole сохраняется на правиле только ради консистентности схемы/каталога ролей UI, в самой
// calculate() не участвует.
export class DepartmentPercentEntity
    extends Entity<DepartmentPercentSalaryRule>
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

    get config(): DepartmentPercentSalaryConfig {
        return this.props.config;
    }

    get isActive(): boolean {
        return this.props.isActive;
    }

    static create(rule: CreateSalaryRuleProps): DepartmentPercentEntity {
        return new DepartmentPercentEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'DepartmentPercent',
                targetRole: rule.targetRole,
                config: rule.config as DepartmentPercentSalaryConfig,
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
     * Implements FR2 of add-department-head-salary-rules.
     *
     * amount = round(fact.(turnover|margin для config.category) * percent / 100) — без какого-либо
     * коэффициента (design.md Decision 2). Фактическое значение резолвится по СОБСТВЕННОЙ category
     * правила (design.md Decision 1) — по аналогии с ProductSoldEntity (shop), а не по отделу целиком.
     * Если для этого scope нет SalesPerformance (нет плана/факта за период, либо у сотрудника нет
     * отдела) — начисляет 0, а не бросает ошибку (design.md Q2, решённый открытый вопрос: явная
     * UI-валидация не нужна).
     */
    calculate(context: ServiceCalculationContext): CalculationLine {
        const entry =
            context.departmentSalesPerformance?.get(this.config.category) ??
            null;

        if (!entry) {
            return this.emptyLine();
        }

        const base = this.resolveBasisAmount(
            entry.fact,
            this.config.salaryBasis,
        );
        const amount = roundRubles((base * this.config.percent) / 100);

        return {
            ruleId: this.id,
            salaryBasis: this.config.salaryBasis,
            rate: this.config.percent,
            amount,
            sources: [],
        };
    }

    validate(): void {}

    // spec: FR2 — формула охватывает только turnover/margin (агрегат отдела/направления, а не
    // база конкретного заказа) — SALARY_MINUS_ENGINEER_SALARY существует только для транзакционных
    // правил уровня заказа (OrderPayed), где есть один конкретный инженер; для правила уровня отдела
    // это осмысленной величины не имеет.
    private resolveBasisAmount(
        fact: { turnover: number; margin: number },
        basis: SalaryBasis,
    ): number {
        switch (basis) {
            case 'REVENUE':
                return fact.turnover;
            case 'MARGIN':
                return fact.margin;
            case 'SALARY_MINUS_ENGINEER_SALARY':
                throw new ArgumentInvalidException(
                    `DepartmentPercent: salaryBasis "${basis}" не поддерживается для правила уровня отдела`,
                );
        }
    }

    private emptyLine(): CalculationLine {
        return {
            ruleId: this.id,
            salaryBasis: this.config.salaryBasis,
            rate: this.config.percent,
            amount: 0,
            sources: [],
        };
    }
}
