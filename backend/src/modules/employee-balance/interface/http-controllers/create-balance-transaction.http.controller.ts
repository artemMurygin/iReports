import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BalanceTransaction } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { CreateBalanceTransactionCommand } from '@/modules/employee-balance/application/command/create-balance-transaction.command';
import { CreateBalanceTransactionDto } from '../dto/create-balance-transaction.dto';

@ApiTags('Бухгалтерия: баланс сотрудника')
@Controller()
export class CreateBalanceTransactionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.accounting.balance.employeeTransactions)
    @ApiOperation({
        summary:
            'Ручное движение по общему балансу сотрудника: аванс/доп. аванс/премия/больничный/отпускные/штраф/корректировка; direction — атрибут происхождения из тела',
    })
    async create(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: CreateBalanceTransactionDto,
    ): Promise<BalanceTransaction> {
        const command = new CreateBalanceTransactionCommand({
            direction: body.direction,
            employeeId: id,
            type: body.type,
            amount: body.amount,
            // occurredAt в контракте — ISO-строка (см. комментарий в
            // createBalanceTransactionRequestSchema), в команду — Date.
            occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
            comment: body.comment,
            period: body.period,
            createdBy: body.createdBy,
            erpSyncRequired: body.erpSyncRequired ?? false,
        });
        return this.commandBus.execute(command);
    }
}
