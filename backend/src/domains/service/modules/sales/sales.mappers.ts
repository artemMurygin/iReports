import {
    BitrixDeal,
    BitrixDeviceTypes,
    BitrixEnumValue,
    BitrixLeadSources,
    BitrixPointOfContact,
    BitrixStage,
    RoappMarketingSource,
    RoappOrder,
    RoappOrderStatus,
    RoappOrderType,
} from './../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { LeadEntity } from './domain/entities/lead.entity';
import { DealEntity } from './domain/entities/deal.entity';
import { Stage } from './domain/value-objects/stage.value-object';
import { LeadSource } from './domain/value-objects/lead-source.value-object';
import { PointOfContact } from './domain/value-objects/point-of-contact.value-object';
import { LeadDeviceInfo } from './domain/value-objects/lead-device-info.value-object';
import { Status } from './domain/value-objects/status.value-object';
import { OrderType } from './domain/value-objects/order-type.value-object';
import { MarketingSource } from './domain/value-objects/marketing-source.object-value';
import { DeviceInfo } from './domain/value-objects/device-infovalue-object';
import { Finance } from './domain/value-objects/finance.value-object';
import { DealTimeline } from './domain/value-objects/deal-timeline.value-object';

export type BitrixDealRow = BitrixDeal & {
    stage: BitrixStage | null;
    pointOfContact: BitrixPointOfContact | null;
    leadSource: BitrixLeadSources | null;
    brand: BitrixEnumValue | null;
    deviceType: BitrixDeviceTypes | null;
};

export class LeadMapper implements Mapper<LeadEntity, BitrixDeal> {
    toDomain(row: BitrixDealRow): LeadEntity {
        return new LeadEntity({
            id: String(row.id),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt ?? undefined,
            props: {
                title: row.title,
                categoryId: row.categoryId,
                stage: row.stage
                    ? new Stage({
                          id: row.stage.id,
                          name: row.stage.name,
                          group: row.stage.stageGroupName,
                      })
                    : null,
                opportunity: row.opportunity ?? 0,
                assignedById: row.assignedById,
                contactId: row.contactId,
                pointOfContact: row.pointOfContact
                    ? new PointOfContact({
                          id: row.pointOfContact.id,
                          name: row.pointOfContact.name,
                      })
                    : null,
                leadSource: row.leadSource
                    ? new LeadSource({
                          id: row.leadSource.id,
                          name: row.leadSource.name,
                      })
                    : null,
                deviceInfo: new LeadDeviceInfo({
                    deviceTypeId: row.deviceTypeId,
                    deviceType: row.deviceType?.name ?? null,
                    brandId: row.brandId,
                    brand: row.brand?.value ?? null,
                    model: row.deviceModel,
                    malfunction: row.deviceMalfunction,
                }),
            },
        });
    }

    toPersistence(entity: LeadEntity): BitrixDeal {
        const props = entity.getProps();

        return {
            id: Number(props.id),
            title: props.title,
            opportunity: props.opportunity,
            categoryId: props.categoryId,
            stageId: props.stage?.getId() ?? null,
            assignedById: props.assignedById,
            contactId: props.contactId,
            pointOfContactId: props.pointOfContact?.getId() ?? null,
            leadSourceId: props.leadSource?.getId() ?? null,
            brandId: props.deviceInfo.getBrandId(),
            deviceTypeId: props.deviceInfo.getDeviceTypeId(),
            deviceModel: props.deviceInfo.getModel(),
            deviceMalfunction: props.deviceInfo.getMalfunction(),
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}

export type RoappOrderRow = RoappOrder & {
    status: RoappOrderStatus | null;
    orderType: RoappOrderType | null;
    adCampaign: RoappMarketingSource | null;
};

export class DealMapper implements Mapper<DealEntity, RoappOrder> {
    toDomain(row: RoappOrderRow): DealEntity {
        return new DealEntity({
            id: String(row.id),
            createdAt: row.createdAt ?? undefined,
            updatedAt: row.modifiedAt ?? undefined,
            props: {
                label: row.label,
                status: new Status({
                    id: row.status?.id ?? row.statusId,
                    name: row.status?.name ?? '',
                    group: row.status?.grupName ?? '',
                }),
                orderType: new OrderType({
                    id: row.orderType?.id ?? row.orderTypeId,
                    name: row.orderType?.name ?? '',
                }),
                marketingSource: row.adCampaign
                    ? new MarketingSource({
                          id: row.adCampaign.id,
                          name: row.adCampaign.name,
                      })
                    : null,
                deviceInfo: new DeviceInfo({
                    brand: row.deviceBrand,
                    model: row.deviceModel,
                    serial: row.deviceSerial,
                    color: row.deviceColor,
                }),
                finance: new Finance({
                    cost: row.cost,
                    payed: row.payed,
                    discountSum: row.discountSum,
                    engineerSalary: row.engineerSalary,
                    managerSalary: row.managerSalary,
                }),
                timeline: new DealTimeline({
                    createdAt: row.createdAt,
                    modifiedAt: row.modifiedAt,
                    dueDate: row.dueDate,
                    doneAt: row.doneAt,
                    closedAt: row.closedAt,
                }),
                bitrixDealId: row.bitrixDealId,
                clientId: row.clientId,
                managerId: row.managerId,
                createdById: row.createdById,
                closedById: row.closedById,
                malfunction: row.malfunction,
                failReason: row.failReason,
                serviceSupplierName: row.serviceSupplierName,
                onlineManager: row.onlineManager,
            },
        });
    }

    toPersistence(entity: DealEntity): RoappOrder {
        const props = entity.getProps();

        return {
            id: Number(props.id),
            label: props.label,
            statusId: props.status.getId(),
            orderTypeId: props.orderType.getId(),
            marketingSource: props.marketingSource?.getId() ?? null,
            bitrixDealId: props.bitrixDealId,
            clientId: props.clientId,
            managerId: props.managerId,
            createdById: props.createdById,
            closedById: props.closedById,
            malfunction: props.malfunction,
            discountSum: props.finance.getDiscountSum(),
            payed: props.finance.getPayed(),
            cost: props.finance.getCost(),
            engineerSalary: props.finance.getEngineerSalary(),
            managerSalary: props.finance.getManagerSalary(),
            deviceBrand: props.deviceInfo.getBrand(),
            deviceModel: props.deviceInfo.getModel(),
            deviceSerial: props.deviceInfo.getSerial(),
            deviceColor: props.deviceInfo.getColor(),
            failReason: props.failReason,
            serviceSupplierName: props.serviceSupplierName,
            onlineManager: props.onlineManager,
            dueDate: props.timeline.getDueDate(),
            doneAt: props.timeline.getDoneAt(),
            closedAt: props.timeline.getClosedAt(),
            modifiedAt: props.timeline.getModifiedAt(),
            createdAt: props.timeline.getCreatedAt(),
        };
    }
}
