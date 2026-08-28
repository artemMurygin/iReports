import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetShopAccountingPeriodService } from '@/domains/shop/modules/accounting/application/services/get-shop-accounting-period.service';

// Статус расчётного периода направления shop — тонкий HTTP-слой поверх
// собственного, независимого GetShopAccountingPeriodService (Фаза 5
// docs/service-shop-boundary-violations-fix), с собственным путём под
// /v1/shop (см. routesV1.shop.accounting.period в app.routes.ts) вместо
// /accounting/period/:direction/:period сервиса.
@ApiTags('Бухгалтерия: расчётный период магазина')
@Controller()
export class GetShopAccountingPeriodHttpController {
    constructor(
        private readonly getAccountingPeriod: GetShopAccountingPeriodService,
    ) {}

    @Get(routesV1.shop.accounting.period.byPeriod)
    @ApiOperation({ summary: 'Статус расчётного периода магазина' })
    async get(
        @Param('period') period: string,
    ): Promise<AccountingPeriodResponse> {
        return this.getAccountingPeriod.execute(period);
    }
}
