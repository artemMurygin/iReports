import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { routesV1 } from '@/config/app.routes';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListShopMotivationSchemasQueryDto } from '../../dto/motivation-schema/list-motivation-schemas-query.dto';
import { ListShopMotivationSchemasResponse } from 'ireports-contracts';
import { ListShopMotivationSchemasService } from '@/domains/shop/modules/accounting/application/services/motivation-schema/list-motivation-schemas.service';

// GET /v1/shop/accounting/motivation-schema (Фаза "Редактирование
// зарплатных схем", issue #57) — зеркало
// ListMotivationSchemasHttpController сервиса, свой namespace
// routesV1.shop.accounting (см. app.routes.ts).
@ApiTags('Бухгалтерия: мотивационная схема')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:view')
@Controller()
export class ListShopMotivationSchemasHttpController {
    constructor(
        private readonly listShopMotivationSchemasService: ListShopMotivationSchemasService,
    ) {}

    @Get(routesV1.shop.accounting.motivationSchema.root)
    @ApiOperation({
        summary:
            'Список мотивационных схем магазина (с фильтрами по цели и поиском по названию)',
    })
    async list(
        @Query() query: ListShopMotivationSchemasQueryDto,
    ): Promise<ListShopMotivationSchemasResponse> {
        return await this.listShopMotivationSchemasService.execute(query);
    }
}
