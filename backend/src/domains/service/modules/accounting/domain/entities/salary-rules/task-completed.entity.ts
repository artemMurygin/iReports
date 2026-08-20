import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateSalaryRuleProps,
    SalaryRule,
    TargetRole,
    TaskCompletedSalaryConfig,
    TaskCompletedSalaryRule,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { roundRubles } from '@/domains/service/modules/accounting/domain/services/money';
import { resolveFloatPercentMultiplier } from '@/domains/service/modules/accounting/domain/services/float-percent';
import { SalesPerformanceRequiredException } from '@/domains/service/modules/accounting/domain/exceptions/float-percent.exception';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';

// Правило "вознаграждение за выполненную задачу" (Фаза 8, см.
// docs/payroll/plan-payroll-calculation.md). Источник данных —
// TaskCompletion (domain/entities/task-completion.entity.ts): ВРЕМЕННЫЙ
// внутренний ручной ввод (сотрудник отмечает выполненной → руководитель
// подтверждает), не интеграция с Bitrix24 Tasks — см. заголовок того
// файла. В расчёт идут только записи в статусе CONFIRMED.
//
// Роль правила (targetRole) здесь НЕ фильтрует выборку — в отличие от
// ServiceCompleted/OrderPayed, у TaskCompletion нет аналога ролевых полей
// ERP (это не запись RemOnline, а внутренняя, привязанная к конкретному
// Bitrix-сотруднику напрямую). Решение по этому открытому вопросу (не
// описанному явно в PRD): матчинг идёт по прямому совпадению
// context.employee.id === completion.employeeId; targetRole остаётся
// обязательным полем контракта (общая часть формы правила для всех типов)
// и используется только для группировки/отображения в UI.
export class TaskCompletedEntity
    extends Entity<TaskCompletedSalaryRule>
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

    get config(): TaskCompletedSalaryConfig {
        return this.props.config;
    }

    static create(rule: CreateSalaryRuleProps): TaskCompletedEntity {
        return new TaskCompletedEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'TaskCompleted',
                targetRole: rule.targetRole,
                config: rule.config as TaskCompletedSalaryConfig,
            },
        });
    }

    calculate(context: CalculationContext): CalculationLine {
        const erpData = context.erpData as
            ServiceCalculationErpData | undefined;
        const completions = erpData?.confirmedTaskCompletions ?? [];
        const matched = completions.filter(
            (completion) => completion.employeeId === context.employee.id,
        );
        const quantity = matched.length;
        const sources = matched.map((completion) => ({
            type: 'taskCompletion',
            id: completion.id,
        }));
        const award = this.props.config.award;

        switch (award.type) {
            case 'Fixed': {
                const amount = award.price * quantity;
                return {
                    ruleId: this.id,
                    quantity,
                    rate: award.price,
                    amount,
                    sources,
                };
            }
            case 'FloatPercent': {
                if (!context.salesPerformance) {
                    throw new SalesPerformanceRequiredException(
                        context.period.period,
                    );
                }
                const multiplier = resolveFloatPercentMultiplier(
                    award.percentBorders,
                    context.salesPerformance.percentCompletion,
                );
                const amount = roundRubles(
                    award.basePrice * quantity * multiplier,
                );
                return {
                    ruleId: this.id,
                    quantity,
                    rate: award.basePrice * multiplier,
                    amount,
                    sources,
                };
            }
        }
    }

    validate(): void {}
}
