import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EmployeeBalanceResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetEmployeeBalanceService } from '@/domains/service/modules/accounting/application/services/get-employee-balance.service';
import { GetEmployeeBalanceQueryDto } from '../dto/get-employee-balance-query.dto';

@ApiTags('Бухгалтерия: баланс сотрудника')
@Controller()
export class GetEmployeeBalanceHttpController {
    constructor(
        private readonly getEmployeeBalance: GetEmployeeBalanceService,
    ) {}

    @Get(routesV1.accounting.balance.employee)
    @ApiOperation({
        summary:
            'Общий баланс сотрудника: остаток (SUM всей ленты по employeeId, без деления на направления) и движения с фильтрами',
    })
    async get(
        @Param('id', ParseIntPipe) id: number,
        @Query() query: GetEmployeeBalanceQueryDto,
    ): Promise<EmployeeBalanceResponse> {
        // Даты в query — ISO-строки (см. getEmployeeBalanceQuerySchema:
        // z.coerce.date() ломает генерацию OpenAPI), в фильтр порта — Date.
        return this.getEmployeeBalance.execute(id, {
            from: query.from ? new Date(query.from) : undefined,
            to: query.to ? new Date(query.to) : undefined,
            types: query.types,
        });
    }
}
