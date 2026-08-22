import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BalanceTransaction } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ReverseBalanceTransactionCommand } from '@/domains/service/modules/accounting/application/command/reverse-balance-transaction.command';
import { ReverseBalanceTransactionDto } from '@/domains/service/modules/accounting/interface/dto/reverse-balance-transaction.dto';

// Сторно ручного движения магазина — тонкий HTTP-слой поверх generic по
// direction ReverseBalanceTransactionCommand (общий CommandBus).
@ApiTags('Бухгалтерия: баланс сотрудника магазина')
@Controller()
export class ReverseShopBalanceTransactionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.balance.reverseTransaction)
    @ApiOperation({
        summary:
            'Сторно ручного движения баланса (shop): MANUAL_REVERSAL на противоположную сумму, исходное движение остаётся с пометкой «сторнировано»',
    })
    async reverse(
        @Param('id') id: string,
        @Body() body: ReverseBalanceTransactionDto,
    ): Promise<BalanceTransaction> {
        const command = new ReverseBalanceTransactionCommand({
            direction: 'shop',
            transactionId: id,
            comment: body.comment,
            createdBy: body.createdBy,
        });
        return this.commandBus.execute(command);
    }
}
