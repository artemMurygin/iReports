import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AdjustShopSalaryAccrualLineCommand } from '@/domains/shop/modules/accounting/application/command/salary-accrual/adjust-salary-accrual-line.command';
import { AdjustShopSalaryAccrualLineDto } from '../../dto/salary-accrual/adjust-salary-accrual-line.dto';

// Корректировка строки документа начисления магазина — тонкий HTTP-слой
// поверх собственной, независимой AdjustShopSalaryAccrualLineCommand
// (Фаза 6 docs/service-shop-boundary-violations-fix).
@ApiTags('Бухгалтерия: начисления зарплаты магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:edit_accrual')
@Controller()
export class AdjustShopSalaryAccrualLineHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Patch(routesV1.shop.accounting.salaryAccruals.lineById)
    @ApiOperation({
        summary:
            'Корректировать строку документа начисления до проведения (shop)',
    })
    async adjust(
        @Param('id') id: string,
        @Param('lineId') lineId: string,
        @Body() body: AdjustShopSalaryAccrualLineDto,
    ): Promise<SalaryAccrualResponse> {
        const command = new AdjustShopSalaryAccrualLineCommand({
            accrualId: id,
            lineId,
            amount: body.amount,
            comment: body.comment,
            adjustedBy: body.adjustedBy,
        });
        return this.commandBus.execute(command);
    }
}
