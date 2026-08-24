import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PayoutPageResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetPayoutPageService } from '@/domains/service/modules/accounting/application/services/get-payout-page.service';

@ApiTags('Бухгалтерия: выплата')
@Controller()
export class GetPayoutPageHttpController {
    constructor(private readonly getPayoutPage: GetPayoutPageService) {}

    @Get(routesV1.service.accounting.payout.byPeriod)
    @ApiOperation({
        summary:
            'Страница выплаты направления service за месяц: начислено/авансы/ручные/остаток/выплачено и статус выплаты по сотрудникам с документами начисления периода + итог',
    })
    async get(@Param('period') period: string): Promise<PayoutPageResponse> {
        return this.getPayoutPage.execute(period);
    }
}
