import { Status } from '../value-objects/status.value-object';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { OrderType } from '../value-objects/order-type.value-object';
import { MarketingSource } from '../value-objects/marketing-source.object-value';
import { DeviceInfo } from '../value-objects/device-infovalue-object';
import { Finance } from '../value-objects/finance.value-object';
import { DealTimeline } from '../value-objects/deal-timeline.value-object';
import { AggregateID } from '@/shared/domain/entity.base';

type DealProps = {
    label: string;
    status: Status;
    orderType: OrderType;
    marketingSource: MarketingSource | null;
    deviceInfo: DeviceInfo;
    finance: Finance;
    timeline: DealTimeline;
    bitrixDealId: number | null;
    clientId: number | null;
    managerId: number | null;
    createdById: number;
    closedById: number | null;
    malfunction: string | null;
    failReason: string | null;
    serviceSupplierName: string | null;
    onlineManager: string | null;
};

export class DealEntity extends AggregateRoot<DealProps> {
    declare protected _id: AggregateID;

    validate(): void {}
}
