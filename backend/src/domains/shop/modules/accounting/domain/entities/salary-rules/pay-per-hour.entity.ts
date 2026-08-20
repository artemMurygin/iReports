import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { roundRubles } from '../../services/money';
import type { ShopCalculationErpData } from '../../types/shop-calculation-data.types';
import type { ShopCalculationContext } from '../../types/shop-calculation-context.types';
import {
    CreateShopSalaryRuleProps,
    PayPerHourShopSalaryConfig,
    PayPerHourShopSalaryRule,
    ShopSalaryRule,
    TargetRole,
} from '../../types/shop-salary-rule.types';

// Зеркало domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity.ts
// (Фаза 12, issue #59) — независимая реализация в домене shop. Формула та
// же (hours × price), источник часов — тоже общий EmployeeHoursEntry
// (ручной ввод, направление-агностичен), но собственный класс: домен shop
// не импортирует PayPerHoursEntity сервиса (issue #57).
export class PayPerHourShopEntity
    extends Entity<PayPerHourShopSalaryRule>
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

    get config(): PayPerHourShopSalaryConfig {
        return this.props.config;
    }

    static create(rule: CreateShopSalaryRuleProps): PayPerHourShopEntity {
        return new PayPerHourShopEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'PayPerHour',
                targetRole: rule.targetRole,
                config: rule.config as PayPerHourShopSalaryConfig,
            },
        });
    }

    // Часов нет в контексте — 0, а не ошибка: правило не обязано быть
    // настроено для каждого сотрудника с этой ролью (то же решение, что и
    // у сервиса, Фаза 7).
    calculate(context: ShopCalculationContext): CalculationLine {
        const erpData = context.erpData as ShopCalculationErpData | undefined;
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
