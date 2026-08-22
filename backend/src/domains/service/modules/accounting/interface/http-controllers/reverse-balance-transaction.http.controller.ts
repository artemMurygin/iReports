import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BalanceTransaction } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ReverseBalanceTransactionCommand } from '@/domains/service/modules/accounting/application/command/reverse-balance-transaction.command';
import { ReverseBalanceTransactionDto } from '../dto/reverse-balance-transaction.dto';

@ApiTags('Бухгалтерия: баланс сотрудника')
@Controller()
export class ReverseBalanceTransactionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.balance.reverseTransaction)
    @ApiOperation({
        summary:
            'Сторно ручного движения баланса (service): MANUAL_REVERSAL на противоположную сумму, исходное движение остаётся с пометкой «сторнировано»',
    })
    async reverse(
        @Param('id') id: string,
        @Body() body: ReverseBalanceTransactionDto,
    ): Promise<BalanceTransaction> {
        const command = new ReverseBalanceTransactionCommand({
            direction: 'service',
            transactionId: id,
            comment: body.comment,
            createdBy: body.createdBy,
        });
        return this.commandBus.execute(command);
    }
}
