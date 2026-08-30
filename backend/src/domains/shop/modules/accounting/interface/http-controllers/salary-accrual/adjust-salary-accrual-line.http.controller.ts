import { Body, Controller, Param, Patch } from '@nestjs/common';
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
