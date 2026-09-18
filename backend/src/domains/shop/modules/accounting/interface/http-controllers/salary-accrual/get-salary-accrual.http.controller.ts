import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetShopSalaryAccrualService } from '@/domains/shop/modules/accounting/application/services/salary-accrual/get-salary-accrual.service';

@ApiTags('Бухгалтерия: начисления зарплаты магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:view_accrual')
@Controller()
export class GetShopSalaryAccrualHttpController {
    constructor(
        private readonly getShopSalaryAccrual: GetShopSalaryAccrualService,
    ) {}

    @Get(routesV1.shop.accounting.salaryAccruals.byId)
    @ApiOperation({
        summary: 'Карточка документа начисления зарплаты направления shop',
    })
    async get(@Param('id') id: string): Promise<SalaryAccrualResponse> {
        return this.getShopSalaryAccrual.execute(id);
    }
}
