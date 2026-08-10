import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateSalaryRuleProps,
    SalaryRule,
    ServiceCompletedSalaryConfig,
    ServiceCompletedSalaryRule,
    TargetRole,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { randomUUID } from 'crypto';

export class ServiceCompletedEntity
    extends Entity<ServiceCompletedSalaryRule>
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

    get config(): ServiceCompletedSalaryConfig {
        return this.props.config;
    }

    // сценарий "создать с нуля": id и даты всегда генерируются заново.
    static create(rule: CreateSalaryRuleProps): ServiceCompletedEntity {
        return new ServiceCompletedEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'ServiceCompleted',
                targetRole: rule.targetRole,
                config: rule.config as ServiceCompletedSalaryConfig,
            },
        });
    }

    // TODO(Фаза 7): расчёт захардкожен и не учитывает config.award (Fixed /
    // ServiceFixed / ServicePercent) — сигнатура уже новая (context →
    // строка расчёта), сама логика ещё нет.
    calculate(_context: CalculationContext): CalculationLine {
        return {
            ruleId: this.id,
            amount: 10,
            sources: [],
        };
    }

    validate(): void {}
}
