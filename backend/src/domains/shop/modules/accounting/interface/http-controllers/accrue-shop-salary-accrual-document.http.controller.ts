import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccrueSalaryAccrualDocumentResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AccrueSalaryAccrualDocumentCommand } from '@/domains/service/modules/accounting/application/command/accrue-salary-accrual-document.command';
import { AccrueSalaryAccrualLineDto } from '@/domains/service/modules/accounting/interface/dto/accrue-salary-accrual-line.dto';

// «Начислить всё» по документу магазина — тонкий HTTP-слой поверх generic
// по direction AccrueSalaryAccrualDocumentCommand модуля accounting сервиса
// (тот же приём, что у AccrueShopSalaryAccrualLineHttpController).
@ApiTags('Бухгалтерия: начисления зарплаты магазина')
@Controller()
export class AccrueShopSalaryAccrualDocumentHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.salaryAccruals.accrueDocument)
    @ApiOperation({
        summary:
            '«Начислить всё»: провести все непроведённые строки документа начисления (shop), ответ — карточка + перечень неудачных строк',
    })
    async accrue(
        @Param('id') id: string,
        @Body() body: AccrueSalaryAccrualLineDto,
    ): Promise<AccrueSalaryAccrualDocumentResponse> {
        const command = new AccrueSalaryAccrualDocumentCommand({
            direction: 'shop',
            accrualId: id,
            accruedBy: body.accruedBy,
        });
        return this.commandBus.execute(command);
    }
}
