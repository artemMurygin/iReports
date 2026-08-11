import { Controller, Get, Param } from '@nestjs/common';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { GetAccountingPeriodService } from '@/domains/service/modules/accounting/application/services/get-accounting-period.service';
import { parseAccountingDirection } from '../utils/parse-accounting-direction';

@Controller('accounting')
export class GetAccountingPeriodHttpController {
    constructor(
        private readonly getAccountingPeriod: GetAccountingPeriodService,
    ) {}

    @Get('period/:direction/:period')
    async get(
        @Param('direction') direction: string,
        @Param('period') period: string,
    ): Promise<AccountingPeriodResponse> {
        return this.getAccountingPeriod.execute(
            parseAccountingDirection(direction),
            period,
        );
    }
}
