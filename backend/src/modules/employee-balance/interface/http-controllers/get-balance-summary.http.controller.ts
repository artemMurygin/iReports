import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BalanceSummaryResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetBalanceSummaryService } from '@/modules/employee-balance/application/services/get-balance-summary.service';
import { GetBalanceSummaryQueryDto } from '@/modules/employee-balance/interface/dto/get-balance-summary-query.dto';

@ApiTags('Бухгалтерия: баланс сотрудника')
@Controller()
export class GetBalanceSummaryHttpController {
    constructor(private readonly getBalanceSummary: GetBalanceSummaryService) {}

    @Get(routesV1.accounting.balance.summary)
    @ApiOperation({
        summary:
            'Сквозной (без направления) список сотрудников — по всем отделам или по одному — с текущим общим остатком, поиском по имени и KPI-агрегатами',
    })
    async get(
        @Param('period') period: string,
        @Query() query: GetBalanceSummaryQueryDto,
    ): Promise<BalanceSummaryResponse> {
        return this.getBalanceSummary.execute(period, {
            departmentId: query.departmentId,
            search: query.search,
        });
    }
}
