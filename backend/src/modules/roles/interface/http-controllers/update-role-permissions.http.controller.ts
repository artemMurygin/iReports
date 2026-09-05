import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RoleResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '../permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { RolesCommandHandlers } from '../../application/command/roles-command-handlers.service';
import { toRoleResponse } from '../../application/mappers/to-role-response';
import { UpdateRolePermissionsDto } from '../dto/update-role-permissions.dto';

// spec: roles#immediate-permission-changes — полная замена набора
// permissions роли + немедленный push пересчитанных permissions во все
// активные сессии сотрудников этой роли (снятое право перестаёт действовать
// без релогина).
@ApiTags('Роли и доступ: управление ролями')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('roles:manage')
@Controller()
export class UpdateRolePermissionsHttpController {
    constructor(private readonly commandHandlers: RolesCommandHandlers) {}

    @Patch(routesV1.roles.updatePermissions)
    @ApiOperation({
        summary:
            'Заменить набор permissions роли (без релогина — изменения сразу применяются ко всем активным сессиям сотрудников этой роли)',
    })
    async update(
        @Param('id') id: string,
        @Body() body: UpdateRolePermissionsDto,
    ): Promise<RoleResponse> {
        const role = await this.commandHandlers.updateRolePermissions(
            id,
            body.permissionCodes,
        );
        return toRoleResponse(role);
    }
}
