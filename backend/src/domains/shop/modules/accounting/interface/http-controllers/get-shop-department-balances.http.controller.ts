import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DepartmentBalancesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetDepartmentBalancesService } from '@/domains/service/modules/accounting/application/services/get-department-balances.service';

// Сводка балансов отдела магазина — собственный экземпляр generic-сервиса
// чтения (см. регистрацию GetDepartmentBalancesService в
// ShopAccountingModule — тот же приём, что GetEmployeeBalanceService).
@ApiTags('Бухгалтерия: баланс сотрудника магазина')
@Controller()
export class GetShopDepartmentBalancesHttpController {
    constructor(
        private readonly getDepartmentBalances: GetDepartmentBalancesService,
    ) {}

    @Get(routesV1.shop.accounting.balance.department)
    @ApiOperation({
        summary:
            'Сводка балансов по отделу за месяц (shop): остаток/начислено/авансы/ручные по сотрудникам текущего отдела Bitrix24 и итог',
    })
    async get(
        @Param('id', ParseIntPipe) id: number,
        @Param('period') period: string,
    ): Promise<DepartmentBalancesResponse> {
        return this.getDepartmentBalances.execute('shop', id, period);
    }
}
