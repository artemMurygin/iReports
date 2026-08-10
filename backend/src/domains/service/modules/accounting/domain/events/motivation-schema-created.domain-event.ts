import {
    DomainEvent,
    DomainEventProps,
} from '@/shared/domain/domain-event.base';
import { SalaryRule } from '../types/salary-rule.types';

export class MotivationSchemaCreatedDomainEvent extends DomainEvent {
    readonly targetType: string;

    readonly targetId: number;

    readonly name: string;

    readonly rules: SalaryRule[];

    constructor(props: DomainEventProps<MotivationSchemaCreatedDomainEvent>) {
        super(props);
        this.targetType = props.targetType;
        this.targetId = props.targetId;
        this.name = props.name;
        this.rules = props.rules;
    }
}
