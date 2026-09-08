import { ValueObject } from '@/shared/domain/value-object.base';

export type LeadSourceProps = {
    id: number;
    name: string;
};

export class LeadSource extends ValueObject<LeadSourceProps> {
    getId() {
        return this.props.id;
    }

    getName() {
        return this.props.name;
    }
}
