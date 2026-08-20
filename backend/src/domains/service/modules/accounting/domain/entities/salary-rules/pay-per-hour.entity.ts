import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { roundRubles } from '../../services/money';
import type { ServiceCalculationErpData } from '../../types/service-calculation-data.types';
import {
    CreateSalaryRuleProps,
    PayPerHourSalaryConfig,
    PayPerHourSalaryRule,
    SalaryRule,
    TargetRole,
} from '../../types/salary-rule.types';

export class PayPerHoursEntity
    extends Entity<PayPerHourSalaryRule>
    implements SalaryRule
{
    declare protected _id: AggregateID;

    // Восстановление уже существующего в БД правила — не через create(), а
    // прямым `new` (см. SalaryRuleMapper.toDomain), поэтому здесь только

    get name(): string {
        return this.props.name;
    }

    get type(): string {
        return this.props.type;
    }

    get targetRole(): TargetRole {
        return this.props.targetRole;
    }

    get config(): PayPerHourSalaryConfig {
        return this.props.config;
    }

    // сценарий "создать с нуля": id и даты всегда генерируются заново.
    static create(rule: CreateSalaryRuleProps): PayPerHoursEntity {
        return new PayPerHoursEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'PayPerHour',
                targetRole: rule.targetRole,
                config: rule.config as PayPerHourSalaryConfig,
            },
        });
    }

    // Источник часов — ручной ввод отработанных часов сотрудника за период
    // (EmployeeHoursEntry, график работы вне скоупа — см. PRD раздел 2,
    // "Не в скоупе"), приходящий в контексте расчёта, а не захардкоженное
    // значение в config (Фаза 7). Часов нет — 0, а не ошибка: правило не
    // обязано быть настроено для каждого сотрудника с этой ролью.
    calculate(context: CalculationContext): CalculationLine {
        const erpData = context.erpData as
            ServiceCalculationErpData | undefined;
        const hours = erpData?.hoursWorked ?? 0;
        const rate = this.props.config.price;

        return {
            ruleId: this.id,
            quantity: hours,
            rate,
            amount: roundRubles(hours * rate),
            sources: [],
        };
    }

    validate(): void {}
}
