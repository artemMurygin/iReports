import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AccrueShopSalaryAccrualLineCommand } from '@/domains/shop/modules/accounting/application/command/salary-accrual/accrue-salary-accrual-line.command';
import { AccrueShopSalaryAccrualLineDto } from '../../dto/salary-accrual/accrue-salary-accrual-line.dto';

// Проведение строки документа начисления магазина — тонкий HTTP-слой поверх
// собственной, независимой AccrueShopSalaryAccrualLineCommand (Фаза 6
// docs/service-shop-boundary-violations-fix).
@ApiTags('Бухгалтерия: начисления зарплаты магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:edit_accrual')
@Controller()
export class AccrueShopSalaryAccrualLineHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.salaryAccruals.lineAccrue)
    @ApiOperation({
        summary:
            'Провести строку документа начисления на баланс сотрудника (shop)',
    })
    async accrue(
        @Param('id') id: string,
        @Param('lineId') lineId: string,
        @Body() body: AccrueShopSalaryAccrualLineDto,
    ): Promise<SalaryAccrualResponse> {
        const command = new AccrueShopSalaryAccrualLineCommand({
            accrualId: id,
            lineId,
            accruedBy: body.accruedBy,
        });
        return this.commandBus.execute(command);
    }
}
