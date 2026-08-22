import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BalanceTransaction } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { CreateBalanceTransactionCommand } from '@/domains/service/modules/accounting/application/command/create-balance-transaction.command';
import { CreateBalanceTransactionDto } from '@/domains/service/modules/accounting/interface/dto/create-balance-transaction.dto';

// Ручное движение по балансу сотрудника магазина — тонкий HTTP-слой поверх
// generic по direction CreateBalanceTransactionCommand (общий CommandBus,
// хендлер зарегистрирован в AccountingModule сервиса; движение ложится на
// баланс пары (employeeId, 'shop')).
@ApiTags('Бухгалтерия: баланс сотрудника магазина')
@Controller()
export class CreateShopBalanceTransactionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.balance.employeeTransactions)
    @ApiOperation({
        summary:
            'Ручное движение по балансу сотрудника (shop): аванс/доп. аванс/премия/больничный/отпускные/штраф/корректировка',
    })
    async create(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: CreateBalanceTransactionDto,
    ): Promise<BalanceTransaction> {
        const command = new CreateBalanceTransactionCommand({
            direction: 'shop',
            employeeId: id,
            type: body.type,
            amount: body.amount,
            occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
            comment: body.comment,
            period: body.period,
            createdBy: body.createdBy,
            erpSyncRequired: body.erpSyncRequired ?? false,
        });
        return this.commandBus.execute(command);
    }
}
