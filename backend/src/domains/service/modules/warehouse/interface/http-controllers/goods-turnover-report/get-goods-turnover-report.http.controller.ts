import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GetGoodsTurnoverReportResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetGoodsTurnoverReportService } from '@/domains/service/modules/warehouse/application/services/goods-turnover-report/get-goods-turnover-report.service';

// Отчёт по оборачиваемости товаров за месяц (задача 10, design.md D8) —
// `period` валидируется доменным VO Period внутри сервиса (см.
// GetAccountingPeriodHttpController, тот же приём: голый строковый
// @Param без отдельного DTO). Своего эндпоинта закрытия нет — месяц
// закрывается вместе с зарплатным AccountingPeriod (design.md D7).
@ApiTags('Сервис: склад')
@Controller()
export class GetGoodsTurnoverReportHttpController {
    constructor(
        private readonly getGoodsTurnoverReport: GetGoodsTurnoverReportService,
    ) {}

    @Get(routesV1.service.warehouse.goodsTurnoverReport.byPeriod)
    @ApiOperation({
        summary: 'Отчёт по оборачиваемости товаров за месяц',
    })
    async get(
        @Param('period') period: string,
    ): Promise<GetGoodsTurnoverReportResponse> {
        return this.getGoodsTurnoverReport.get(period);
    }
}
