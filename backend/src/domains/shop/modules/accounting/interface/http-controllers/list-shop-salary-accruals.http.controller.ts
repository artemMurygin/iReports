import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualListResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListSalaryAccrualsService } from '@/domains/service/modules/accounting/application/services/list-salary-accruals.service';
import { ListShopSalaryAccrualsQueryDto } from '../dto/list-shop-salary-accruals-query.dto';

// Список документов начисления магазина (PRD 1 docs/payroll-closing-and-accrual)
// — собственный путь под /v1/shop, direction подставляется контроллером;
// ListSalaryAccrualsService переиспользован как generic-по-direction класс
// (собственный экземпляр в ShopAccountingModule), тем же приёмом, что и
// GetAccountingPeriodService.
@ApiTags('Бухгалтерия: начисления зарплаты магазина')
@Controller()
export class ListShopSalaryAccrualsHttpController {
    constructor(
        private readonly listSalaryAccruals: ListSalaryAccrualsService,
    ) {}

    @Get(routesV1.shop.accounting.salaryAccruals.root)
    @ApiOperation({
        summary: 'Документы начисления зарплаты направления shop за период',
    })
    async list(
        @Query() query: ListShopSalaryAccrualsQueryDto,
    ): Promise<SalaryAccrualListResponse> {
        return this.listSalaryAccruals.execute('shop', query.period);
    }
}
