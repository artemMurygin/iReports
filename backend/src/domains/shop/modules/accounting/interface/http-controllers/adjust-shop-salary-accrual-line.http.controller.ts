import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AdjustSalaryAccrualLineCommand } from '@/domains/service/modules/accounting/application/command/adjust-salary-accrual-line.command';
import { AdjustSalaryAccrualLineDto } from '@/domains/service/modules/accounting/interface/dto/adjust-salary-accrual-line.dto';

// Корректировка строки документа начисления магазина — тонкий HTTP-слой
// поверх generic по direction команды (см.
// AccrueShopSalaryAccrualLineHttpController).
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
        @Body() body: AdjustSalaryAccrualLineDto,
    ): Promise<SalaryAccrualResponse> {
        const command = new AdjustSalaryAccrualLineCommand({
            direction: 'shop',
            accrualId: id,
            lineId,
            amount: body.amount,
            comment: body.comment,
            adjustedBy: body.adjustedBy,
        });
        return this.commandBus.execute(command);
    }
}
