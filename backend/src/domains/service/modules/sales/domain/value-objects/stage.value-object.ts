import { ValueObject } from '@/shared/domain/value-object.base';

export type StageProps = {
    id: string;
    name: string;
    group: string | null;
};

export class Stage extends ValueObject<StageProps> {
    getId() {
        return this.props.id;
    }

    getName() {
        return this.props.name;
    }

    getGroup() {
        return this.props.group;
    }
}
