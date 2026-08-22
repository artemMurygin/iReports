import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AccrueSalaryAccrualLineCommand } from '@/domains/service/modules/accounting/application/command/accrue-salary-accrual-line.command';
import { AccrueSalaryAccrualLineDto } from '@/domains/service/modules/accounting/interface/dto/accrue-salary-accrual-line.dto';

// Проведение строки документа начисления магазина — тонкий HTTP-слой поверх
// generic по direction AccrueSalaryAccrualLineCommand модуля accounting
// сервиса (тот же приём, что у ReopenShopAccountingPeriodHttpController):
// хендлер зарегистрирован один раз, направление — данные команды.
@ApiTags('Бухгалтерия: начисления зарплаты магазина')
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
        @Body() body: AccrueSalaryAccrualLineDto,
    ): Promise<SalaryAccrualResponse> {
        const command = new AccrueSalaryAccrualLineCommand({
            direction: 'shop',
            accrualId: id,
            lineId,
            accruedBy: body.accruedBy,
        });
        return this.commandBus.execute(command);
    }
}
