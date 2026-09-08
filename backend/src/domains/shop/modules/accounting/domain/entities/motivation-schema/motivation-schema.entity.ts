import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { randomUUID } from 'crypto';
import { AggregateID } from '@/shared/domain/entity.base';
import { ShopMotivationSchemaCreatedDomainEvent } from '../../events/motivation-schema-created.domain-event';
import {
    ShopMotivationSchemaCreateProps,
    ShopMotivationSchemaProps,
} from '../../types/motivation-schema.types';
import { ShopMotivationTarget } from '../../value-objects/motivation-target.value-object';

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

    // Переименование схемы (PATCH /v1/shop/accounting/motivation-schema/:id,
    // редактирование зарплатной схемы) — прямая мутация props, тот же
    // паттерн, что у AccountingPeriod.close()/reopen() сервисного
    // accounting. Без нового domain-события: инвалидация ленивого кэша
    // расчёта уже опирается на updatedAt схемы/правил (Prisma `@updatedAt`
    // проставит его сам при персисте), отдельное событие не нужно.
    rename(name: string): void {
        this.props.name = name;
    }
}
