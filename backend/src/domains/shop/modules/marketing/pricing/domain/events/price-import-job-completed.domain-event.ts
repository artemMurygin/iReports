import {
    DomainEvent,
    DomainEventProps,
} from '@/shared/domain/domain-event.base';

export class PriceImportJobCompletedDomainEvent extends DomainEvent {
    readonly matchedCount: number;

    readonly updatedCount: number;

    constructor(props: DomainEventProps<PriceImportJobCompletedDomainEvent>) {
        super(props);
        this.matchedCount = props.matchedCount;
        this.updatedCount = props.updatedCount;
    }
}
