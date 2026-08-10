import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
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

    // Часы пока вводятся вручную в config (график работы — вне скоупа Фазы
    // 1, см. PRD раздел 2), поэтому context в этой итерации не используется
    // самим расчётом, но принимается — сигнатура едина для всех правил.
    calculate(_context: CalculationContext): CalculationLine {
        const hours = this.props.config.hours ?? 0;
        const rate = this.props.config.price;

        return {
            ruleId: this.id,
            quantity: hours,
            rate,
            amount: hours * rate,
            sources: [],
        };
    }

    validate(): void {}
}
