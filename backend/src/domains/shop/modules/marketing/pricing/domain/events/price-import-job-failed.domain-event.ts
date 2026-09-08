import {
    DomainEvent,
    DomainEventProps,
} from '@/shared/domain/domain-event.base';

export class PriceImportJobFailedDomainEvent extends DomainEvent {
    readonly errorMessage: string;

    constructor(props: DomainEventProps<PriceImportJobFailedDomainEvent>) {
        super(props);
        this.errorMessage = props.errorMessage;
    }
}
