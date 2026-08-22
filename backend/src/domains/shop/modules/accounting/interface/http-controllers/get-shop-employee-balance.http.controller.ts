import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EmployeeBalanceResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetEmployeeBalanceService } from '@/domains/service/modules/accounting/application/services/get-employee-balance.service';
import { GetEmployeeBalanceQueryDto } from '@/domains/service/modules/accounting/interface/dto/get-employee-balance-query.dto';

// Баланс сотрудника направления shop — generic по direction сервис чтения,
// собственный экземпляр в ShopAccountingModule (тот же приём, что у
// ListSalaryAccrualsService/GetSalaryAccrualService).
@ApiTags('Бухгалтерия: баланс сотрудника магазина')
@Controller()
export class GetShopEmployeeBalanceHttpController {
    constructor(
        private readonly getEmployeeBalance: GetEmployeeBalanceService,
    ) {}

    @Get(routesV1.shop.accounting.balance.employee)
    @ApiOperation({
        summary:
            'Баланс сотрудника направления shop: остаток (SUM ленты) и движения с фильтрами',
    })
    async get(
        @Param('id', ParseIntPipe) id: number,
        @Query() query: GetEmployeeBalanceQueryDto,
    ): Promise<EmployeeBalanceResponse> {
        // Даты в query — ISO-строки (см. getEmployeeBalanceQuerySchema:
        // z.coerce.date() ломает генерацию OpenAPI), в фильтр порта — Date.
        return this.getEmployeeBalance.execute('shop', id, {
            from: query.from ? new Date(query.from) : undefined,
            to: query.to ? new Date(query.to) : undefined,
            types: query.types,
        });
    }
}
