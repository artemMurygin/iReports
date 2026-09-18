import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { routesV1 } from '@/config/app.routes';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ShopMotivationSchemaDetailResponse } from 'ireports-contracts';
import { GetShopMotivationSchemaService } from '@/domains/shop/modules/accounting/application/services/motivation-schema/get-motivation-schema.service';

// GET /v1/shop/accounting/motivation-schema/:id (Фаза "Редактирование
// зарплатных схем", issue #57) — зеркало
// GetMotivationSchemaHttpController сервиса, свой namespace
// routesV1.shop.accounting (см. app.routes.ts). 404, если строки нет ИЛИ у
// неё 0 правил direction='shop' (см. GetShopMotivationSchemaService).
@ApiTags('Бухгалтерия: мотивационная схема')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:view')
@Controller()
export class GetShopMotivationSchemaHttpController {
    constructor(
        private readonly getShopMotivationSchemaService: GetShopMotivationSchemaService,
    ) {}

    @Get(routesV1.shop.accounting.motivationSchema.byId)
    @ApiOperation({
        summary: 'Мотивационная схема магазина со всеми правилами по id',
    })
    async get(
        @Param('id') id: string,
    ): Promise<ShopMotivationSchemaDetailResponse> {
        return await this.getShopMotivationSchemaService.execute(id);
    }
}
