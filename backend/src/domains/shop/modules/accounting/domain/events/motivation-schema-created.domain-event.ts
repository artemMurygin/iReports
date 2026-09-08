import {
    DomainEvent,
    DomainEventProps,
} from '@/shared/domain/domain-event.base';
import { ShopSalaryRule } from '../types/salary-rule.types';
import { ShopMotivationTarget } from '../value-objects/motivation-target.value-object';

// Зеркало domains/service/modules/accounting/domain/events/
// motivation-schema-created.domain-event.ts (Фаза 13.5, issue #57) —
// независимая копия для направления shop. Обработчик (временный
// debug-логгер у сервиса) сознательно не заводится — вне скоупа этой
// задачи.
export class ShopMotivationSchemaCreatedDomainEvent extends DomainEvent {
    readonly target: ShopMotivationTarget;

    readonly name: string;

    readonly rules: ShopSalaryRule[];

    constructor(
        props: DomainEventProps<ShopMotivationSchemaCreatedDomainEvent>,
    ) {
        super(props);
        this.target = props.target;
        this.name = props.name;
        this.rules = props.rules;
    }
}
