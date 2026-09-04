import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AdjustSalaryAccrualLineCommand } from '@/domains/service/modules/accounting/application/command/salary-accrual/adjust-salary-accrual-line.command';
import { AdjustSalaryAccrualLineDto } from '../../dto/salary-accrual/adjust-salary-accrual-line.dto';

@ApiTags('Бухгалтерия: начисления зарплаты')
@Controller()
export class AdjustSalaryAccrualLineHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Комментарий обязателен уже на этой границе
    // (adjustSalaryAccrualLineRequestSchema: comment — min(1)) — 400 раньше,
    // чем запрос дойдёт до домена.
    @Patch(routesV1.service.accounting.salaryAccruals.lineById)
    @ApiOperation({
        summary:
            'Корректировать строку документа начисления до проведения (service)',
    })
    async adjust(
        @Param('id') id: string,
        @Param('lineId') lineId: string,
        @Body() body: AdjustSalaryAccrualLineDto,
    ): Promise<SalaryAccrualResponse> {
        const command = new AdjustSalaryAccrualLineCommand({
            direction: 'service',
            accrualId: id,
            lineId,
            amount: body.amount,
            comment: body.comment,
            adjustedBy: body.adjustedBy,
        });
        return this.commandBus.execute(command);
    }
}
