import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListRolesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { PermissionsGuard } from '../permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { RolesQueryHandlers } from '../../application/services/roles-query-handlers.service';
import { toRoleResponse } from '../../application/mappers/to-role-response';

// spec: roles#admin-page-requires-roles-manage — вся страница управления
// ролями, включая read-only список, доступна только с roles:manage (403
// без него). Guard'ы применены точечно на контроллере (см. WHY в
// app.module.ts про отложенную глобальную регистрацию APP_GUARD).
@ApiTags('Роли и доступ: управление ролями')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions('roles:manage')
@Controller()
export class ListRolesHttpController {
    constructor(private readonly queryHandlers: RolesQueryHandlers) {}

    @Get(routesV1.roles.root)
    @ApiOperation({ summary: 'Список всех ролей' })
    async list(): Promise<ListRolesResponse> {
        const roles = await this.queryHandlers.getRoles();
        return roles.map(toRoleResponse);
    }
}
