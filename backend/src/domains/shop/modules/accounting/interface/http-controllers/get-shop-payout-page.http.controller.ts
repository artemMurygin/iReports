import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PayoutPageResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetShopPayoutPageService } from '@/domains/shop/modules/accounting/application/services/get-shop-payout-page.service';

@ApiTags('Бухгалтерия: выплата магазина')
@Controller()
export class GetShopPayoutPageHttpController {
    constructor(private readonly getPayoutPage: GetShopPayoutPageService) {}

    @Get(routesV1.shop.accounting.payout.byPeriod)
    @ApiOperation({
        summary:
            'Страница выплаты направления shop за месяц: начислено/авансы/ручные/остаток/выплачено и статус выплаты по сотрудникам с документами начисления периода + итог',
    })
    async get(@Param('period') period: string): Promise<PayoutPageResponse> {
        return this.getPayoutPage.execute(period);
    }
}
