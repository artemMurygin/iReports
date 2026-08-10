import { ValueObject } from '@/shared/domain/value-object.base';

export type DealTimelineProps = {
    createdAt: Date | null;
    modifiedAt: Date | null;
    dueDate: Date | null;
    doneAt: Date | null;
    closedAt: Date | null;
};

export class DealTimeline extends ValueObject<DealTimelineProps> {
    getCreatedAt() {
        return this.props.createdAt;
    }

    getModifiedAt() {
        return this.props.modifiedAt;
    }

    getDueDate() {
        return this.props.dueDate;
    }

    getDoneAt() {
        return this.props.doneAt;
    }

    getClosedAt() {
        return this.props.closedAt;
    }

    isClosed() {
        return this.props.closedAt !== null;
    }

    isDone() {
        return this.props.doneAt !== null;
    }

    isOverdue() {
        return (
            this.props.dueDate !== null &&
            !this.isClosed() &&
            this.props.dueDate < new Date()
        );
    }
}
