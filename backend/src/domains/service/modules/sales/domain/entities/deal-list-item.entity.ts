import { Entity, AggregateID } from '@/shared/domain/entity.base';
import { DealListStage } from '../value-objects/deal-list-stage.value-object';
import { DealAssignee } from '../value-objects/deal-assignee.value-object';
import { DealPointOfContact } from '../value-objects/deal-point-of-contact.value-object';
import { DealLeadSource } from '../value-objects/deal-lead-source.value-object';
import { DealBrand } from '../value-objects/deal-brand.value-object';
import { DealDeviceType } from '../value-objects/deal-device-type.value-object';

// Read-модель одной строки списка сделок (GET /v1/service/sales/deals,
// см. docs/todo-modules-ddd-refactoring) — плоская проекция bitrix_deals
// для отображения списком, а не агрегат бизнес-процесса: нет ни
// инвариантов, ни доменных событий, поэтому Entity, а не AggregateRoot
// (так же, как LeadEntity в этом модуле — другая read-модель того же рода
// поверх той же таблицы, см. lead.entity.ts). id/createdAt/updatedAt не
// дублируются в Props — они уже часть Entity (BaseEntityProps), см.
// entity.base.ts и тот же выбор в LeadProps/DealProps.
//
// Группы полей, у которых на BitrixDeal есть отдельная связанная
// Prisma-модель (stage/assignedBy/pointOfContact/leadSource/brand/
// deviceType), представлены VO вместо голых объектов — см. правило про
// value objects в backend/CLAUDE.md. Простые атрибуты без собственной
// валидации (title/opportunity/categoryId/deviceModel/deviceMalfunction)
// остаются примитивами.
export type DealListItemProps = {
    title: string | null;
    opportunity: number | null;
    categoryId: number;
    deviceModel: string | null;
    deviceMalfunction: string | null;
    stage: DealListStage | null;
    assignedBy: DealAssignee | null;
    pointOfContact: DealPointOfContact | null;
    leadSource: DealLeadSource | null;
    brand: DealBrand | null;
    deviceType: DealDeviceType | null;
};

export class DealListItemEntity extends Entity<DealListItemProps> {
    declare protected _id: AggregateID;

    validate(): void {}
}
