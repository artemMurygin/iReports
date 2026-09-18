import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { UnaccrueShopSalaryAccrualLineCommand } from '@/domains/shop/modules/accounting/application/command/salary-accrual/unaccrue-salary-accrual-line.command';

// Отмена начисления строки документа магазина — тонкий HTTP-слой поверх
// собственной, независимой UnaccrueShopSalaryAccrualLineCommand (Фаза 6
// docs/service-shop-boundary-violations-fix).
@ApiTags('Бухгалтерия: начисления зарплаты магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:edit_accrual')
@Controller()
export class UnaccrueShopSalaryAccrualLineHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.salaryAccruals.lineUnaccrue)
    @ApiOperation({
        summary:
            'Отменить начисление строки документа — удалить её движения с баланса (shop)',
    })
    async unaccrue(
        @Param('id') id: string,
        @Param('lineId') lineId: string,
    ): Promise<SalaryAccrualResponse> {
        const command = new UnaccrueShopSalaryAccrualLineCommand({
            accrualId: id,
            lineId,
        });
        return this.commandBus.execute(command);
    }
}
