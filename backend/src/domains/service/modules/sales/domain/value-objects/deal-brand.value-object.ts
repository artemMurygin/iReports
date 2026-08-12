import { ValueObject } from '@/shared/domain/value-object.base';

// Бренд устройства сделки для read-модели списка сделок (deal list, GET
// /v1/service/sales/deals) — резолвится через Prisma-связь BitrixDeal.brand
// ("DealBrand") на модель BitrixEnumValue (id/fieldName/value/sort).
// Отдельный тип от DealDeviceType: несмотря на то, что brand/deviceType
// выглядят как "два похожих enum-поля" на фронтенде (оба типизированы как
// ApiEnumValue), их реальные Prisma-модели разной формы — BitrixEnumValue
// (это поле) против BitrixDeviceTypes (id/name, см. deal-device-type.value-object.ts)
// — общий VO для них означал бы либо придумывать несуществующие поля, либо
// терять реальные.
export type DealBrandProps = {
    id: number;
    fieldName: string;
    value: string;
    sort: number;
};

export class DealBrand extends ValueObject<DealBrandProps> {
    getId() {
        return this.props.id;
    }

    getFieldName() {
        return this.props.fieldName;
    }

    getValue() {
        return this.props.value;
    }

    getSort() {
        return this.props.sort;
    }
}
