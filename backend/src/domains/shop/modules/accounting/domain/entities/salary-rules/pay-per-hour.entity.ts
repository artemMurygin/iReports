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
// же (hours × price), источник часов — тоже общий график работы
// (WorkScheduleEntry, Фаза 5, direction-агностичен), но собственный класс:
// домен shop не импортирует PayPerHoursEntity сервиса (issue #57).
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

    // erpData.hoursWorked несёт ОБА значения (fact/prognose) сразу — режим
    // (FACT/PROGNOSE) выбирает нужное, дата "сегодня" и фильтр по роли дня
    // (ONLINE_MANAGER/OFFLINE_MANAGER, см. domain/services/
    // pay-per-hour-roles.ts) уже учтены на стороне, собравшей контекст (см.
    // ShopCalculationDataRepository.findHoursWorked). Часов нет в
    // контексте — 0, а не ошибка: правило не обязано быть настроено для
    // каждого сотрудника с этой ролью (то же решение, что и у сервиса).
    calculate(context: ShopCalculationContext): CalculationLine {
        const erpData = context.erpData as ShopCalculationErpData | undefined;
        const hours =
            context.mode === 'FACT'
                ? (erpData?.hoursWorked?.fact ?? 0)
                : (erpData?.hoursWorked?.prognose ?? 0);
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
