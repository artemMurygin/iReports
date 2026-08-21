import {
    DomainEvent,
    DomainEventProps,
} from '@/shared/domain/domain-event.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// "Документы начисления созданы" (PRD 1 docs/payroll-closing-and-accrual,
// "Доменное событие") — публикуется хендлером закрытия периода после коммита
// транзакции, в которой вместе со снапшотом и переводом периода в CLOSED
// записаны документы начисления. Событие одно на всё закрытие (список
// accrualId), а не по одному на документ: подписчик PRD 2 (проведение на
// баланс) оперирует месяцем направления целиком. aggregateId — id
// AccountingPeriod, закрытие которого породило документы.
export class SalaryAccrualDocumentsCreatedDomainEvent extends DomainEvent {
    readonly direction: AccountingDirection;

    readonly period: string;

    readonly accrualIds: string[];

    constructor(
        props: DomainEventProps<SalaryAccrualDocumentsCreatedDomainEvent>,
    ) {
        super(props);
        this.direction = props.direction;
        this.period = props.period;
        this.accrualIds = props.accrualIds;
    }
}
