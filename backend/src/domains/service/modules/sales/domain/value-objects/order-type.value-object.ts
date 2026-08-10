import { ValueObject } from '@/shared/domain/value-object.base';

export type OrderTypeProps = {
    id: number;
    name: string;
};

export class OrderType extends ValueObject<OrderTypeProps> {
    getName() {
        return this.props.name;
    }

    getId() {
        return this.props.id;
    }
}
