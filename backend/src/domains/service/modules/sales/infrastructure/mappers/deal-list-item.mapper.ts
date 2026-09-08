import {
    BitrixDeal,
    BitrixDeviceTypes,
    BitrixEmployee,
    BitrixEnumValue,
    BitrixLeadSources,
    BitrixPointOfContact,
    BitrixStage,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { DealListItemEntity } from '@/domains/service/modules/sales/domain/entities/deal-list-item.entity';
import { DealListStage } from '@/domains/service/modules/sales/domain/value-objects/deal-list-stage.value-object';
import { DealAssignee } from '@/domains/service/modules/sales/domain/value-objects/deal-assignee.value-object';
import { DealPointOfContact } from '@/domains/service/modules/sales/domain/value-objects/deal-point-of-contact.value-object';
import { DealLeadSource } from '@/domains/service/modules/sales/domain/value-objects/deal-lead-source.value-object';
import { DealBrand } from '@/domains/service/modules/sales/domain/value-objects/deal-brand.value-object';
import { DealDeviceType } from '@/domains/service/modules/sales/domain/value-objects/deal-device-type.value-object';

// Форма строки ровно та, что реально отдаёт Prisma-запрос
// DealListRepository.findByDateRange (include: stage/assignedBy/
// pointOfContact/leadSource/brand/deviceType) — тот же набор связей, что и
// у легаси DealsService.getDeals (src/TODO/deals/deals.service.ts), см.
// комментарий в контракте (contracts/commands/deal.ts) про byte-identical
// поведение.
export type DealListRow = BitrixDeal & {
    stage: BitrixStage | null;
    assignedBy: BitrixEmployee | null;
    pointOfContact: BitrixPointOfContact | null;
    leadSource: BitrixLeadSources | null;
    brand: BitrixEnumValue | null;
    deviceType: BitrixDeviceTypes | null;
};

export class DealListItemMapper implements Mapper<
    DealListItemEntity,
    BitrixDeal
> {
    toDomain(row: DealListRow): DealListItemEntity {
        return new DealListItemEntity({
            id: String(row.id),
            createdAt: row.createdAt,
            // ЗНАЕМ, НО НЕ ЧИНИМ В ЭТОЙ ФАЗЕ: BitrixDeal.updatedAt в БД
            // легитимно бывает NULL (Bitrix DATE_MODIFY пуст —
            // src/integrations/bitrix/schema.ts явно пишет
            // `updatedAt: null`, это не автозаполняемое Prisma-поле, т.к.
            // sync передаёт его в data explicitly). Контракт
            // (dealListItemSchema.updatedAt) намеренно nullable ради этого.
            // Но Entity.constructor (shared/domain/entity.base.ts) не умеет
            // хранить updatedAt = null — `updatedAt || now` подставляет
            // текущее время вместо null, точно как в LeadMapper для той же
            // таблицы (sales.mappers.ts). Значит для строк с пустым
            // DATE_MODIFY ответ этого read-side'а разойдётся с legacy
            // `GET /deals` (там updatedAt: null дословно из БД) — see stage 2
            // summary для явного флага на стадию 3/4: либо переносить
            // updatedAt в Props как явный nullable-примитив, либо признать
            // расхождение приемлемым.
            updatedAt: row.updatedAt ?? undefined,
            props: {
                title: row.title,
                opportunity: row.opportunity,
                categoryId: row.categoryId,
                deviceModel: row.deviceModel,
                deviceMalfunction: row.deviceMalfunction,
                stage: row.stage
                    ? new DealListStage({
                          id: row.stage.id,
                          name: row.stage.name,
                          sort: row.stage.sort,
                          color: row.stage.color,
                          systemType: row.stage.systemType,
                          stageGroupId: row.stage.stageGroupId,
                          stageGroupName: row.stage.stageGroupName,
                      })
                    : null,
                assignedBy: row.assignedBy
                    ? new DealAssignee({
                          id: row.assignedBy.id,
                          firstName: row.assignedBy.firstName,
                          lastName: row.assignedBy.lastName,
                      })
                    : null,
                pointOfContact: row.pointOfContact
                    ? new DealPointOfContact({
                          id: row.pointOfContact.id,
                          name: row.pointOfContact.name,
                          sort: row.pointOfContact.sort,
                      })
                    : null,
                leadSource: row.leadSource
                    ? new DealLeadSource({
                          id: row.leadSource.id,
                          name: row.leadSource.name,
                      })
                    : null,
                brand: row.brand
                    ? new DealBrand({
                          id: row.brand.id,
                          fieldName: row.brand.fieldName,
                          value: row.brand.value,
                          sort: row.brand.sort,
                      })
                    : null,
                deviceType: row.deviceType
                    ? new DealDeviceType({
                          id: row.deviceType.id,
                          name: row.deviceType.name,
                      })
                    : null,
            },
        });
    }

    // Read-модель списка сделок (DealListItemEntity, см.
    // domain/entities/deal-list-item.entity.ts) — плоская проекция
    // bitrix_deals только для отображения списком, никогда не пишется
    // обратно в БД: запись в bitrix_deals — забота синка Bitrix (см.
    // src/sync/bitrix), а не этого read-side'а. toPersistence реализован
    // только чтобы удовлетворить интерфейс Mapper<> (оба метода обязательны,
    // см. shared/domain/mapper.interface.ts) — вызов означал бы ошибку в
    // вызывающем коде, а не легитимный сценарий.
    toPersistence(): BitrixDeal {
        throw new Error(
            'DealListItemMapper.toPersistence не реализован: read-модель списка сделок не персистится',
        );
    }
}
