import { ValueObject } from '@/shared/domain/value-object.base';

export type LeadDeviceInfoProps = {
    deviceTypeId: number | null;
    deviceType: string | null;
    brandId: number | null;
    brand: string | null;
    model: string | null;
    malfunction: string | null;
};

export class LeadDeviceInfo extends ValueObject<LeadDeviceInfoProps> {
    getDeviceTypeId() {
        return this.props.deviceTypeId;
    }

    getDeviceType() {
        return this.props.deviceType;
    }

    getBrandId() {
        return this.props.brandId;
    }

    getBrand() {
        return this.props.brand;
    }

    getModel() {
        return this.props.model;
    }

    getMalfunction() {
        return this.props.malfunction;
    }
}
