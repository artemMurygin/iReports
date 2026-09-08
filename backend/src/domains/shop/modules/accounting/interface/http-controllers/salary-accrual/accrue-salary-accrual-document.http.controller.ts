import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccrueSalaryAccrualDocumentResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AccrueShopSalaryAccrualDocumentCommand } from '@/domains/shop/modules/accounting/application/command/salary-accrual/accrue-salary-accrual-document.command';
import { AccrueShopSalaryAccrualLineDto } from '../../dto/salary-accrual/accrue-salary-accrual-line.dto';

// «Начислить всё» по документу магазина — тонкий HTTP-слой поверх
// собственной, независимой AccrueShopSalaryAccrualDocumentCommand (Фаза 6
// docs/service-shop-boundary-violations-fix).
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
        @Body() body: AccrueShopSalaryAccrualLineDto,
    ): Promise<AccrueSalaryAccrualDocumentResponse> {
        const command = new AccrueShopSalaryAccrualDocumentCommand({
            accrualId: id,
            accruedBy: body.accruedBy,
        });
        return this.commandBus.execute(command);
    }
}
