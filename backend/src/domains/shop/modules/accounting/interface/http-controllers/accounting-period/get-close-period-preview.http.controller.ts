import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ClosePeriodPreviewResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetShopClosePeriodPreviewService } from '@/domains/shop/modules/accounting/application/services/accounting-period/get-close-period-preview.service';

// Сводка закрытия направления shop — тонкий HTTP-слой поверх собственного,
// независимого GetShopClosePeriodPreviewService (Фаза 5
// docs/service-shop-boundary-violations-fix); калькулятор строк под
// SHOP_SNAPSHOT_ROWS_CALCULATOR — свой, shop-овский (см. ShopAccountingModule).
@ApiTags('Бухгалтерия: расчётный период магазина')
@Controller()
export class GetShopClosePeriodPreviewHttpController {
    constructor(
        private readonly getClosePeriodPreview: GetShopClosePeriodPreviewService,
    ) {}

    @Get(routesV1.shop.accounting.period.closePreview)
    @ApiOperation({
        summary:
            'Сводка окна подтверждения закрытия периода магазина: сотрудники, уволенные, фонд оплаты, неутверждённые строки плана, сотрудники без часов',
    })
    async get(
        @Param('period') period: string,
    ): Promise<ClosePeriodPreviewResponse> {
        return this.getClosePeriodPreview.execute(period);
    }
}
