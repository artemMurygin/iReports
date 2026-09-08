import { ValueObject } from '@/shared/domain/value-object.base';

// Контактное лицо сделки для read-модели списка сделок (deal list, GET
// /v1/service/sales/deals) — НЕ переиспользует PointOfContact
// (point-of-contact.value-object.ts): тот VO принадлежит другой
// read-модели (воронка лидов) и не хранит sort. Этот список должен
// отдавать полную форму BitrixPointOfContact (id/name/sort).
export type DealPointOfContactProps = {
    id: string;
    name: string;
    sort: number;
};

export class DealPointOfContact extends ValueObject<DealPointOfContactProps> {
    getId() {
        return this.props.id;
    }

    getName() {
        return this.props.name;
    }

    getSort() {
        return this.props.sort;
    }
}
