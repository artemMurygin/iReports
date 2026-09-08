import { ValueObject } from '@/shared/domain/value-object.base';

// Тип устройства сделки для read-модели списка сделок (deal list, GET
// /v1/service/sales/deals) — резолвится через Prisma-связь
// BitrixDeal.deviceType на модель BitrixDeviceTypes (только id/name). См.
// комментарий в deal-brand.value-object.ts про то, почему brand и
// deviceType не делят один VO, несмотря на общий тип ApiEnumValue на
// фронтенде.
export type DealDeviceTypeProps = {
    id: number;
    name: string;
};

export class DealDeviceType extends ValueObject<DealDeviceTypeProps> {
    getId() {
        return this.props.id;
    }

    getName() {
        return this.props.name;
    }
}
