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
import { RenameRoleDto } from '../dto/rename-role.dto';

@ApiTags('Роли и доступ: управление ролями')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('roles:manage')
@Controller()
export class RenameRoleHttpController {
    constructor(private readonly commandHandlers: RolesCommandHandlers) {}

    @Patch(routesV1.roles.byId)
    @ApiOperation({ summary: 'Переименовать роль' })
    async rename(
        @Param('id') id: string,
        @Body() body: RenameRoleDto,
    ): Promise<RoleResponse> {
        const role = await this.commandHandlers.renameRole(id, body.name);
        return toRoleResponse(role);
    }
}
