import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { randomUUID } from 'crypto';
import { AggregateID } from '@/shared/domain/entity.base';
import { MotivationSchemaCreatedDomainEvent } from '../../events/motivation-schema-created.domain-event';
import {
    MotivationSchemaCreateProps,
    MotivationSchemaProps,
} from '../../types/motivation-schema.types';
import { MotivationTarget } from '../../value-objects/motivation-target.value-object';

export class MotivationSchema extends AggregateRoot<MotivationSchemaProps> {
    declare protected readonly _id: AggregateID;

    // targetType/targetId — ещё голые примитивы (форма command/DTO);
    // MotivationTarget.create() сам провалидирует их и бросит
    // ArgumentInvalidException при пустом type/id, поэтому props уже
    // приходят в validate() валидными.
    static create(create: MotivationSchemaCreateProps): MotivationSchema {
        const id = randomUUID();
        const target = MotivationTarget.create(
            create.targetType,
            create.targetId,
        );
        const props: MotivationSchemaProps = {
            target,
            name: create.name,
            rules: create.rules,
        };
        const motivationSchema = new MotivationSchema({ id, props });
        motivationSchema.addEvent(
            new MotivationSchemaCreatedDomainEvent({
                aggregateId: id,
                target,
                name: props.name,
                rules: props.rules,
            }),
        );

        return motivationSchema;
    }

    // Переименование схемы (PATCH .../motivation-schema/:id) — прямая
    // мутация props, тот же паттерн, что и у AccountingPeriod.close()/
    // reopen(). Замена набора правил (Delete+recreate) — ответственность
    // application-слоя (UpdateMotivationSchemaHandler, координирующего
    // SalaryRuleRepositoryPort/CommandBus), а не этой сущности: набор правил
    // здесь читается (props.rules), но не персистится этим методом.
    rename(name: string): void {
        this.props.name = name;
    }

    validate(): void {}
}
