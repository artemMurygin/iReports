import type {
    DealListStage as DealListStageResponse,
    DealAssignee as DealAssigneeResponse,
    DealLeadSource as DealLeadSourceResponse,
    DealDeviceType as DealDeviceTypeResponse,
    DealStageGroup as DealStageGroupResponse,
} from 'ireports-contracts';
import { DealListStage } from '../../domain/value-objects/deal-list-stage.value-object';
import { DealAssignee } from '../../domain/value-objects/deal-assignee.value-object';
import { DealLeadSource } from '../../domain/value-objects/deal-lead-source.value-object';
import { DealDeviceType } from '../../domain/value-objects/deal-device-type.value-object';
import { DealStageGroup } from '../../domain/value-objects/deal-stage-group.value-object';

// VO → плоская форма контракта для справочников сделок (см.
// application/ports/deal-catalog.port.ts), по образцу
// to-deal-list-item-response.ts — читает значения через геттеры VO, ничего
// не вычисляет. Контрактные типы одноимённы с доменными VO (DealListStage,
// DealAssignee, ...), поэтому импортируются с алиасом *Response.

export function toDealListStageResponse(
    stage: DealListStage,
): DealListStageResponse {
    return {
        id: stage.getId(),
        name: stage.getName(),
        sort: stage.getSort(),
        color: stage.getColor(),
        systemType: stage.getSystemType(),
        stageGroupId: stage.getStageGroupId(),
        stageGroupName: stage.getStageGroupName(),
    };
}

export function toDealAssigneeResponse(
    assignee: DealAssignee,
): DealAssigneeResponse {
    return {
        id: assignee.getId(),
        firstName: assignee.getFirstName(),
        lastName: assignee.getLastName(),
    };
}

export function toDealLeadSourceResponse(
    source: DealLeadSource,
): DealLeadSourceResponse {
    return { id: source.getId(), name: source.getName() };
}

export function toDealDeviceTypeResponse(
    deviceType: DealDeviceType,
): DealDeviceTypeResponse {
    return { id: deviceType.getId(), name: deviceType.getName() };
}

export function toDealStageGroupResponse(
    stageGroup: DealStageGroup,
): DealStageGroupResponse {
    return { id: stageGroup.getId(), name: stageGroup.getName() };
}
