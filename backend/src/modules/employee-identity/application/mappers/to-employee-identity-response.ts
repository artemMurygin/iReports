import type { EmployeeIdentityResponse } from 'ireports-contracts';
import { EmployeeIdentity } from '../../domain/entities/employee-identity.entity';

// Общая точка сборки HTTP-ответа из доменной сущности — используется всеми
// командами/сервисами модуля, чтобы форма ответа не расходилась между
// create/update/list.
export function toEmployeeIdentityResponse(
    entity: EmployeeIdentity,
): EmployeeIdentityResponse {
    const props = entity.getProps();
    return {
        id: props.id,
        bitrixEmployeeId: props.bitrixEmployeeId,
        system: props.system,
        identifierType: props.identifierType,
        externalId: props.externalId,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
    };
}
