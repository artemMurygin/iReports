import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DepartmentBalancesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetDepartmentBalancesService } from '@/domains/service/modules/accounting/application/services/get-department-balances.service';

@ApiTags('Бухгалтерия: баланс сотрудника')
@Controller()
export class GetDepartmentBalancesHttpController {
    constructor(
        private readonly getDepartmentBalances: GetDepartmentBalancesService,
    ) {}

    @Get(routesV1.accounting.balance.department)
    @ApiOperation({
        summary:
            'Сводка общих балансов по отделу за месяц: остаток/начислено/авансы/ручные по сотрудникам текущего отдела Bitrix24 и итог',
    })
    async get(
        @Param('id', ParseIntPipe) id: number,
        @Param('period') period: string,
    ): Promise<DepartmentBalancesResponse> {
        return this.getDepartmentBalances.execute(id, period);
    }
}
