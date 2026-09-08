import { ValueObject } from '@/shared/domain/value-object.base';

export type StatusProps = {
    id: number;
    name: string;
    group: string;
};

export class Status extends ValueObject<StatusProps> {
    getName() {
        return this.props.name;
    }

    getGroup() {
        return this.props.group;
    }

    getId() {
        return this.props.id;
    }
}
