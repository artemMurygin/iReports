import {
    DomainEvent,
    DomainEventProps,
} from '@/shared/domain/domain-event.base';
import { SalaryRule } from '../types/salary-rule.types';
import { MotivationTarget } from '../value-objects/motivation-target.value-object';

export class MotivationSchemaCreatedDomainEvent extends DomainEvent {
    readonly target: MotivationTarget;

    readonly name: string;

    readonly rules: SalaryRule[];

    constructor(props: DomainEventProps<MotivationSchemaCreatedDomainEvent>) {
        super(props);
        this.target = props.target;
        this.name = props.name;
        this.rules = props.rules;
    }
}
