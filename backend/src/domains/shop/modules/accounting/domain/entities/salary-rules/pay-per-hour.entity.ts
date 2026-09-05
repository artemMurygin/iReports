import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { Money } from '../../value-objects/money.value-object';
import type { ShopCalculationErpData } from '../../types/calculation-data.types';
import type { ShopCalculationContext } from '../../types/calculation-context.types';
import {
    CreateShopSalaryRuleProps,
    PayPerHourShopSalaryConfig,
    PayPerHourShopSalaryRule,
    ShopSalaryRule,
    TargetRole,
} from '../../types/salary-rule.types';

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

    // spec: shop/accounting#requirement-виды-зарплатных-правил
    //
    // В shop нет SOLO_MANAGER — тот существует только у service (см.
    // ELIGIBLE_SCHEDULE_ROLES сервисного PayPerHoursEntity). Факт уровня ТИПА
    // правила, не конкретного экземпляра — не связан с targetRole экземпляра
    // (см. calculate() ниже) — поэтому static, а не поле props. Читается
    // напрямую отсюда инфраструктурным ShopCalculationDataRepository.findHoursWorked
    // при построении Prisma-запроса к WorkScheduleEntry — правило PayPerHour
    // единственное место в домене, которому известно, какие роли графика
    // оно считает часами, поэтому эта политика — часть самой сущности
    // правила, а не отдельного domain-сервиса.
    static readonly ELIGIBLE_SCHEDULE_ROLES: readonly TargetRole[] = [
        'ONLINE_MANAGER',
        'OFFLINE_MANAGER',
    ];

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
    // (см. ELIGIBLE_SCHEDULE_ROLES выше) уже учтены на стороне, собравшей
    // контекст (см. ShopCalculationDataRepository.findHoursWorked).
    // spec: shop/accounting#requirement-виды-зарплатных-правил
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
            amount: Money.roundRubles(hours * rate).getValue(),
            sources: [],
        };
    }

    validate(): void {}
}
