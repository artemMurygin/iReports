import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PayoutBatchResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { CreatePayoutBatchCommand } from '@/domains/service/modules/accounting/application/command/create-payout-batch.command';
import { PayoutBatchDto } from '../dto/payout-batch.dto';

@ApiTags('Бухгалтерия: выплата')
@Controller()
export class CreatePayoutBatchHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.payout.batch)
    @ApiOperation({
        summary:
            '«Выплатить выбранным» направления service: по каждому сотруднику — выплата на его остаток на момент операции; ответ — перечень успехов/ошибок/требующих подтверждения',
    })
    async batch(@Body() body: PayoutBatchDto): Promise<PayoutBatchResponse> {
        const command = new CreatePayoutBatchCommand({
            employeeIds: body.employeeIds,
            occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
            comment: body.comment,
            createdBy: body.createdBy,
            confirmNegativeBalance: body.confirmNegativeBalance,
        });
        return this.commandBus.execute(command);
    }
}
