import { Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { UnaccrueSalaryAccrualLineCommand } from '@/domains/service/modules/accounting/application/command/unaccrue-salary-accrual-line.command';

@ApiTags('Бухгалтерия: начисления зарплаты')
@Controller()
export class UnaccrueSalaryAccrualLineHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Тело не требуется: отмена не создаёт новых движений (движения строки
    // удаляются), автора фиксировать не в чем.
    @Post(routesV1.service.accounting.salaryAccruals.lineUnaccrue)
    @ApiOperation({
        summary:
            'Отменить начисление строки документа — удалить её движения с баланса (service)',
    })
    async unaccrue(
        @Param('id') id: string,
        @Param('lineId') lineId: string,
    ): Promise<SalaryAccrualResponse> {
        const command = new UnaccrueSalaryAccrualLineCommand({
            direction: 'service',
            accrualId: id,
            lineId,
        });
        return this.commandBus.execute(command);
    }
}
