import type { DealListItem } from 'ireports-contracts';
import { DealListItemEntity } from '../../domain/entities/deal-list-item.entity';

// Entity (+ VOs) → плоская форма контракта, по образцу
// to-sales-plan-response.ts — читает значения через геттеры VO, ничего не
// вычисляет.
export function toDealListItemResponse(
    entity: DealListItemEntity,
): DealListItem {
    const props = entity.getProps();

    return {
        id: Number(props.id),
        title: props.title,
        opportunity: props.opportunity,
        categoryId: props.categoryId,
        deviceModel: props.deviceModel,
        deviceMalfunction: props.deviceMalfunction,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
        stage: props.stage
            ? {
                  id: props.stage.getId(),
                  name: props.stage.getName(),
                  sort: props.stage.getSort(),
                  color: props.stage.getColor(),
                  systemType: props.stage.getSystemType(),
                  stageGroupId: props.stage.getStageGroupId(),
                  stageGroupName: props.stage.getStageGroupName(),
              }
            : null,
        assignedBy: props.assignedBy
            ? {
                  id: props.assignedBy.getId(),
                  firstName: props.assignedBy.getFirstName(),
                  lastName: props.assignedBy.getLastName(),
              }
            : null,
        pointOfContact: props.pointOfContact
            ? {
                  id: props.pointOfContact.getId(),
                  name: props.pointOfContact.getName(),
                  sort: props.pointOfContact.getSort(),
              }
            : null,
        leadSource: props.leadSource
            ? {
                  id: props.leadSource.getId(),
                  name: props.leadSource.getName(),
              }
            : null,
        brand: props.brand
            ? {
                  id: props.brand.getId(),
                  fieldName: props.brand.getFieldName(),
                  value: props.brand.getValue(),
                  sort: props.brand.getSort(),
              }
            : null,
        deviceType: props.deviceType
            ? {
                  id: props.deviceType.getId(),
                  name: props.deviceType.getName(),
              }
            : null,
    };
}
