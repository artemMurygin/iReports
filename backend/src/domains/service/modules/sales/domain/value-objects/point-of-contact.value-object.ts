import { ValueObject } from '@/shared/domain/value-object.base';

export type PointOfContactProps = {
    id: string;
    name: string;
};

export class PointOfContact extends ValueObject<PointOfContactProps> {
    getId() {
        return this.props.id;
    }

    getName() {
        return this.props.name;
    }
}
