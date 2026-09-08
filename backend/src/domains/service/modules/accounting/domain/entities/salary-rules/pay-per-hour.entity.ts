import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { roundRubles } from '../../services/money';
import type { ServiceCalculationErpData } from '../../types/calculation-data.types';
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

    // spec: service/accounting#scenario-в-расчёт-входят-только-смены-менеджерских-ролей
    //
    // Факт уровня ТИПА правила, не конкретного экземпляра — не связан с targetRole экземпляра (см.
    // calculate() ниже) — поэтому static, а не поле props. Читается напрямую отсюда
    // инфраструктурным ServiceCalculationDataRepository.findHoursWorked при построении
    // Prisma-запроса к WorkScheduleEntry — правило PayPerHour единственное место в домене, которому
    // известно, какие роли графика оно считает часами, поэтому эта политика — часть самой сущности
    // правила, а не отдельного domain-сервиса.
    static readonly ELIGIBLE_SCHEDULE_ROLES: readonly TargetRole[] = [
        'ONLINE_MANAGER',
        'OFFLINE_MANAGER',
        'SOLO_MANAGER',
    ];

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

    // spec: service/accounting#scenario-отсутствие-подходящих-часов-начисление-0-а-не-ошибка
    //
    // Часы приходят в контексте расчёта, а не читаются здесь напрямую. erpData.hoursWorked несёт
    // ОБА значения (fact/prognose) сразу — режим (FACT/PROGNOSE) выбирает нужное, дата "сегодня" уже
    // учтена на стороне, собравшей контекст (см. ServiceCalculationDataRepository.findHoursWorked).
    calculate(context: CalculationContext): CalculationLine {
        const erpData = context.erpData as
            ServiceCalculationErpData | undefined;
        const hours = erpData
            ? context.mode === 'FACT'
                ? erpData.hoursWorked.fact
                : erpData.hoursWorked.prognose
            : 0;
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
