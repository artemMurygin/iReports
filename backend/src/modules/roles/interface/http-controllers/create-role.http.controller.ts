import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RoleResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '../permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { RolesCommandHandlers } from '../../application/command/roles-command-handlers.service';
import { toRoleResponse } from '../../application/mappers/to-role-response';
import { CreateRoleDto } from '../dto/create-role.dto';

// spec: roles#model-role-permission — новая роль (опционально сразу с
// набором permissions ИЗ каталога) создаётся через API без деплоя.
@ApiTags('Роли и доступ: управление ролями')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('roles:manage')
@Controller()
export class CreateRoleHttpController {
    constructor(private readonly commandHandlers: RolesCommandHandlers) {}

    @Post(routesV1.roles.root)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary:
            'Создать роль, опционально сразу с набором permissions ИЗ каталога',
    })
    async create(@Body() body: CreateRoleDto): Promise<RoleResponse> {
        const role = await this.commandHandlers.createRole(
            body.name,
            body.permissionCodes,
        );
        return toRoleResponse(role);
    }
}
