import {
    DomainEvent,
    DomainEventProps,
} from '@/shared/domain/domain-event.base';

export class PriceImportJobCancelledDomainEvent extends DomainEvent {
    constructor(props: DomainEventProps<PriceImportJobCancelledDomainEvent>) {
        super(props);
    }
}
