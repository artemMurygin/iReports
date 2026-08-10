import { ValueObject } from '@/shared/domain/value-object.base';

export type DeviceInfoProps = {
    color: string | null;
    brand: string | null;
    model: string | null;
    serial: string | null;
};

export class DeviceInfo extends ValueObject<DeviceInfoProps> {
    getColor() {
        return this.props.color;
    }

    getBrand() {
        return this.props.brand;
    }

    getModel() {
        return this.props.model;
    }

    getSerial() {
        return this.props.serial;
    }

    getFullDevice() {
        const { color, brand, model, serial } = this.props;

        return (
            [brand, model, color].filter(Boolean).join(' ') +
            (serial ? ` (${serial})` : '')
        );
    }
}
