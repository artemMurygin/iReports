import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AccrueSalaryAccrualLineCommand } from '@/domains/service/modules/accounting/application/command/accrue-salary-accrual-line.command';
import { AccrueSalaryAccrualLineDto } from '../dto/accrue-salary-accrual-line.dto';

@ApiTags('Бухгалтерия: начисления зарплаты')
@Controller()
export class AccrueSalaryAccrualLineHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.salaryAccruals.lineAccrue)
    @ApiOperation({
        summary:
            'Провести строку документа начисления на баланс сотрудника (service)',
    })
    async accrue(
        @Param('id') id: string,
        @Param('lineId') lineId: string,
        @Body() body: AccrueSalaryAccrualLineDto,
    ): Promise<SalaryAccrualResponse> {
        const command = new AccrueSalaryAccrualLineCommand({
            direction: 'service',
            accrualId: id,
            lineId,
            accruedBy: body.accruedBy,
        });
        return this.commandBus.execute(command);
    }
}
