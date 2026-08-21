import { Entity } from '../domain/entity.base';
import { ValueObject } from '../domain/value-object.base';

function isEntity(obj: unknown): obj is Entity<unknown> {
    /**
     * 'instanceof Entity' causes error here for some reason.
     * Probably creates some circular dependency. This is a workaround
     * until I find a solution :)
     */
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'toObject' in obj &&
        'id' in obj &&
        ValueObject.isValueObject(obj.id)
    );
}

function convertToPlainObject(item: unknown): unknown {
    if (ValueObject.isValueObject(item)) {
        return item.unpack();
    }
    if (isEntity(item)) {
        return item.toObject();
    }
    return item;
}

/**
 * Converts Entity/Value Objects props to a plain object.
 * Useful for testing and debugging.
 * @param props
 */
export function convertPropsToObject(props: unknown): Record<string, unknown> {
    const propsCopy = structuredClone(props) as Record<string, unknown>;

    for (const prop in propsCopy) {
        const value = propsCopy[prop];
        if (Array.isArray(value)) {
            propsCopy[prop] = (value as unknown[]).map((item) =>
                convertToPlainObject(item),
            );
        }
        propsCopy[prop] = convertToPlainObject(propsCopy[prop]);
    }

    return propsCopy;
}
