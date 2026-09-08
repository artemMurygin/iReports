import {
    DomainEvent,
    DomainEventProps,
} from '@/shared/domain/domain-event.base';

// Зеркало domains/service/modules/accounting/domain/events/
// accounting-period-closed.domain-event.ts (Фаза 5
// docs/service-shop-boundary-violations-fix) — независимая копия для
// направления shop, без временного лог-хендлера (см. WHY у
// AccountingPeriodClosedEventHandler сервиса — задача формирования
// salaryReport по этому событию вне скоупа текущей итерации для обоих
// направлений).
export class ShopAccountingPeriodClosedDomainEvent extends DomainEvent {
    readonly period: string;

    readonly closedBy: number;

    readonly employeeCount: number;

    constructor(
        props: DomainEventProps<ShopAccountingPeriodClosedDomainEvent>,
    ) {
        super(props);
        this.period = props.period;
        this.closedBy = props.closedBy;
        this.employeeCount = props.employeeCount;
    }
}
