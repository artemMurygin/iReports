import { ValueObject } from '@/shared/domain/value-object.base';

export type MarketingSourceProps = {
    id: number;
    name: string;
};

export class MarketingSource extends ValueObject<MarketingSourceProps> {
    getName() {
        return this.props.name;
    }

    getId() {
        return this.props.id;
    }
}
