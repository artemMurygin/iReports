import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetAccountingPeriodService } from '@/domains/service/modules/accounting/application/services/get-accounting-period.service';

// Статус расчётного периода направления shop — тонкий HTTP-слой поверх
// GetAccountingPeriodService модуля accounting сервиса (класс уже generic
// по direction, свой сервисный экземпляр заводить незачем, см.
// domains/service/CLAUDE.md), с собственным путём под /v1/shop (см.
// routesV1.shop.accounting.period в app.routes.ts) вместо
// /accounting/period/:direction/:period сервиса.
@ApiTags('Бухгалтерия: расчётный период магазина')
@Controller()
export class GetShopAccountingPeriodHttpController {
    constructor(
        private readonly getAccountingPeriod: GetAccountingPeriodService,
    ) {}

    @Get(routesV1.shop.accounting.period.byPeriod)
    @ApiOperation({ summary: 'Статус расчётного периода магазина' })
    async get(
        @Param('period') period: string,
    ): Promise<AccountingPeriodResponse> {
        return this.getAccountingPeriod.execute('shop', period);
    }
}
