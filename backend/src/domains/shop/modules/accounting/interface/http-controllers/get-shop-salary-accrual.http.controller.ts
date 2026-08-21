import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetSalaryAccrualService } from '@/domains/service/modules/accounting/application/services/get-salary-accrual.service';

@ApiTags('Бухгалтерия: начисления зарплаты магазина')
@Controller()
export class GetShopSalaryAccrualHttpController {
    constructor(private readonly getSalaryAccrual: GetSalaryAccrualService) {}

    @Get(routesV1.shop.accounting.salaryAccruals.byId)
    @ApiOperation({
        summary: 'Карточка документа начисления зарплаты направления shop',
    })
    async get(@Param('id') id: string): Promise<SalaryAccrualResponse> {
        return this.getSalaryAccrual.execute('shop', id);
    }
}
