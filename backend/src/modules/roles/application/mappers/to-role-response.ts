import type { RoleResponse } from 'ireports-contracts';
import { Role } from '../../domain/entities/role.entity';

// Единая точка сборки DTO ответа из доменного Role — переиспользуется всеми
// контроллерами roles, возвращающими роль(и) (create/rename/update-permissions/
// list), чтобы форма ответа не разъезжалась между эндпоинтами.
export function toRoleResponse(role: Role): RoleResponse {
    return {
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
        permissionCodes: role.permissionCodes,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
    };
}
