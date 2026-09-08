import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListPermissionsCatalogResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { PermissionsGuard } from '../permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { RolesQueryHandlers } from '../../application/services/roles-query-handlers.service';

// spec: roles#permission-catalog-from-code — каталог формируется ТОЛЬКО из
// типизированного реестра кода (PermissionsCatalogSeeder, design.md
// Decision 12); этот эндпоинт read-only — источник строк матрицы
// "роль × permission" на UI, не принимает и не создаёт новые коды.
@ApiTags('Роли и доступ: управление ролями')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions('roles:manage')
@Controller()
export class ListPermissionsCatalogHttpController {
    constructor(private readonly queryHandlers: RolesQueryHandlers) {}

    @Get(routesV1.roles.permissionsCatalog)
    @ApiOperation({
        summary:
            'Каталог permission-кодов (наполняется только из кода — PermissionsCatalogSeeder)',
    })
    async list(): Promise<ListPermissionsCatalogResponse> {
        return this.queryHandlers.getPermissionsCatalog();
    }
}
