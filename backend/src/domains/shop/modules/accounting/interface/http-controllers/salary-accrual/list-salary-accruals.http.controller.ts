import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualListResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListShopSalaryAccrualsService } from '@/domains/shop/modules/accounting/application/services/salary-accrual/list-salary-accruals.service';
import { ListShopSalaryAccrualsQueryDto } from '../../dto/salary-accrual/list-salary-accruals-query.dto';

// Список документов начисления магазина (PRD 1 docs/payroll-closing-and-accrual)
// — собственный путь под /v1/shop, обслуживается собственным, независимым
// ListShopSalaryAccrualsService (Фаза 6 docs/service-shop-boundary-violations-fix)
// вместо generic-по-direction сервиса сервиса.
@ApiTags('Бухгалтерия: начисления зарплаты магазина')
@Controller()
export class ListShopSalaryAccrualsHttpController {
    constructor(
        private readonly listShopSalaryAccruals: ListShopSalaryAccrualsService,
    ) {}

    @Get(routesV1.shop.accounting.salaryAccruals.root)
    @ApiOperation({
        summary: 'Документы начисления зарплаты направления shop за период',
    })
    async list(
        @Query() query: ListShopSalaryAccrualsQueryDto,
    ): Promise<SalaryAccrualListResponse> {
        return this.listShopSalaryAccruals.execute(query.period);
    }
}
