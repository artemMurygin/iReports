import {
    DomainEvent,
    DomainEventProps,
} from '@/shared/domain/domain-event.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// "Месяц закрыт" (см. docs/payroll/prd-payroll-calculation.md, раздел 4:
// "Событие 'Месяц закрыт' → формирование salaryReport") — формирование
// salaryReport само по себе вне скоупа этой итерации (см. "Не в скоупе" PRD:
// "Баланс сотрудника и начисление зарплаты"), поэтому обработчик события в
// Фазе 6 — временный лог-хендлер, как и MotivationSchemaCreatedEventHandler
// в своё время в Фазе 1.
export class AccountingPeriodClosedDomainEvent extends DomainEvent {
    readonly direction: AccountingDirection;

    readonly period: string;

    readonly closedBy: number;

    readonly employeeCount: number;

    constructor(props: DomainEventProps<AccountingPeriodClosedDomainEvent>) {
        super(props);
        this.direction = props.direction;
        this.period = props.period;
        this.closedBy = props.closedBy;
        this.employeeCount = props.employeeCount;
    }
}
