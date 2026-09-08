import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '../permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { RolesCommandHandlers } from '../../application/command/roles-command-handlers.service';

// spec: roles#model-role-permission — системную роль Administrator удалить
// нельзя (SystemRoleCannotBeDeletedException → 409 через
// DomainExceptionFilter, design.md Decision 9).
@ApiTags('Роли и доступ: управление ролями')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('roles:manage')
@Controller()
export class DeleteRoleHttpController {
    constructor(private readonly commandHandlers: RolesCommandHandlers) {}

    @Delete(routesV1.roles.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Удалить роль (кроме системной Administrator)' })
    async delete(@Param('id') id: string): Promise<void> {
        await this.commandHandlers.deleteRole(id);
    }
}
