import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { randomUUID } from 'crypto';
import { AggregateID } from '@/shared/domain/entity.base';
import { ShopMotivationSchemaCreatedDomainEvent } from '../events/shop-motivation-schema-created.domain-event';
import {
    ShopMotivationSchemaCreateProps,
    ShopMotivationSchemaProps,
} from '../types/shop-motivation-schema.types';
import { ShopMotivationTarget } from '../value-objects/shop-motivation-target.value-object';

// Зеркало domains/service/modules/accounting/domain/entities/
// motivation-schema.entity.ts (Фаза 13.5, issue #57) — независимая копия
// для направления shop.
export class ShopMotivationSchema extends AggregateRoot<ShopMotivationSchemaProps> {
    declare protected readonly _id: AggregateID;

    // targetType/targetId — ещё голые примитивы (форма command/DTO);
    // ShopMotivationTarget.create() сам провалидирует их и бросит
    // ArgumentInvalidException при пустом type/id, поэтому props уже
    // приходят в validate() валидными.
    static create(
        create: ShopMotivationSchemaCreateProps,
    ): ShopMotivationSchema {
        const id = randomUUID();
        const target = ShopMotivationTarget.create(
            create.targetType,
            create.targetId,
        );
        const props: ShopMotivationSchemaProps = {
            target,
            name: create.name,
            rules: create.rules,
        };
        const motivationSchema = new ShopMotivationSchema({ id, props });
        motivationSchema.addEvent(
            new ShopMotivationSchemaCreatedDomainEvent({
                aggregateId: id,
                target,
                name: props.name,
                rules: props.rules,
            }),
        );

        return motivationSchema;
    }

    validate(): void {}
}
