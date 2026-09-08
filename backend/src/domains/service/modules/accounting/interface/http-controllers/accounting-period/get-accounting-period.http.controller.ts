import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetAccountingPeriodService } from '@/domains/service/modules/accounting/application/services/accounting-period/get-accounting-period.service';

@ApiTags('Бухгалтерия: расчётный период')
@Controller()
export class GetAccountingPeriodHttpController {
    constructor(
        private readonly getAccountingPeriod: GetAccountingPeriodService,
    ) {}

    @Get(routesV1.service.accounting.period.byPeriod)
    @ApiOperation({ summary: 'Статус расчётного периода' })
    async get(
        @Param('period') period: string,
    ): Promise<AccountingPeriodResponse> {
        return this.getAccountingPeriod.execute('service', period);
    }
}
