import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { randomUUID } from 'crypto';
import { AggregateID } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { MotivationSchemaCreatedDomainEvent } from '../events/motivation-schema-created.domain-event';
import { MotivationSchemaCreateProps } from '../types/motivation-schema.types';

export class MotivationSchema extends AggregateRoot<MotivationSchemaCreateProps> {
    declare protected readonly _id: AggregateID;

    static create(create: MotivationSchemaCreateProps): MotivationSchema {
        const id = randomUUID();
        const props = {
            id,
            ...create,
        };
        const motivationSchema = new MotivationSchema({ id, props });
        motivationSchema.addEvent(
            new MotivationSchemaCreatedDomainEvent({
                aggregateId: id,
                targetType: props.targetType,
                targetId: props.targetId,
                name: props.name,
                rules: props.rules,
            }),
        );

        return motivationSchema;
    }

    validate(): void {
        if (!this.props.targetType || !this.props.targetId) {
            throw new ArgumentInvalidException(
                'Необходимо указать targetType и targetId для правила мотивации!',
            );
        }
    }
}
