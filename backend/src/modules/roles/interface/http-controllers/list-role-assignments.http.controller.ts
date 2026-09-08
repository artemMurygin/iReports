import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListRoleAssignmentsResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { PermissionsGuard } from '../permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { RolesQueryHandlers } from '../../application/services/roles-query-handlers.service';
import { toRoleAssignmentResponse } from '../../application/mappers/to-role-assignment-response';

// spec: roles#model-role-permission — назначения роль<->сотрудник
// (EmployeeRole) для таблицы «Сотрудники» на админ-странице ролей (раздел
// 22 tasks.md, useEmployeeRoleAssignment на frontend); только сотрудники, у
// которых есть хотя бы одна роль. Read-only, тот же guard-стек, что и у
// остальных эндпоинтов модуля roles (roles:manage).
@ApiTags('Роли и доступ: управление ролями')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions('roles:manage')
@Controller()
export class ListRoleAssignmentsHttpController {
    constructor(private readonly queryHandlers: RolesQueryHandlers) {}

    @Get(routesV1.roles.assignments)
    @ApiOperation({
        summary: 'Назначения ролей сотрудникам (только с хотя бы одной ролью)',
    })
    async list(): Promise<ListRoleAssignmentsResponse> {
        const assignments = await this.queryHandlers.getRoleAssignments();
        return assignments.map(toRoleAssignmentResponse);
    }
}
