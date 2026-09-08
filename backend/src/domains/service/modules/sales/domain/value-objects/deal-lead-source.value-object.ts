import { ValueObject } from '@/shared/domain/value-object.base';

// Источник лида сделки для read-модели списка сделок (deal list, GET
// /v1/service/sales/deals) — НЕ переиспользует LeadSource
// (lead-source.value-object.ts): тот VO принадлежит другой read-модели
// (воронка лидов). Форма совпадает (id/name — реальные поля
// BitrixLeadSources, без sort), но это отдельный тип с собственным именем,
// чтобы не завязывать две независимые read-модели на общий класс.
export type DealLeadSourceProps = {
    id: number;
    name: string;
};

export class DealLeadSource extends ValueObject<DealLeadSourceProps> {
    getId() {
        return this.props.id;
    }

    getName() {
        return this.props.name;
    }
}
