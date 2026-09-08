import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '../permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { RolesCommandHandlers } from '../../application/command/roles-command-handlers.service';

@ApiTags('Роли и доступ: управление ролями')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('roles:manage')
@Controller()
export class RevokeRoleFromEmployeeHttpController {
    constructor(private readonly commandHandlers: RolesCommandHandlers) {}

    @Delete(routesV1.roles.employeeAssignment)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Снять роль с сотрудника' })
    async revoke(
        @Param('id') roleId: string,
        @Param('employeeId', ParseIntPipe) employeeId: number,
    ): Promise<void> {
        await this.commandHandlers.revokeRoleFromEmployee(employeeId, roleId);
    }
}
