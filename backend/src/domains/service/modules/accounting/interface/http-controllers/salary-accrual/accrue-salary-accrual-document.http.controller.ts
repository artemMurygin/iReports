import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccrueSalaryAccrualDocumentResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AccrueSalaryAccrualDocumentCommand } from '@/domains/service/modules/accounting/application/command/salary-accrual/accrue-salary-accrual-document.command';
import { AccrueSalaryAccrualLineDto } from '../../dto/salary-accrual/accrue-salary-accrual-line.dto';

@ApiTags('Бухгалтерия: начисления зарплаты')
@Controller()
export class AccrueSalaryAccrualDocumentHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.salaryAccruals.accrueDocument)
    @ApiOperation({
        summary:
            '«Начислить всё»: провести все непроведённые строки документа начисления (service), ответ — карточка + перечень неудачных строк',
    })
    async accrue(
        @Param('id') id: string,
        @Body() body: AccrueSalaryAccrualLineDto,
    ): Promise<AccrueSalaryAccrualDocumentResponse> {
        const command = new AccrueSalaryAccrualDocumentCommand({
            direction: 'service',
            accrualId: id,
            accruedBy: body.accruedBy,
        });
        return this.commandBus.execute(command);
    }
}
