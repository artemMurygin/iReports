import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PayoutResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { CreatePayoutCommand } from '@/domains/service/modules/accounting/application/command/erp-cash-payout/create-payout.command';
import { CreatePayoutDto } from '../../dto/erp-cash-payout/create-payout.dto';

@ApiTags('Бухгалтерия: выплата')
@Controller()
export class CreatePayoutHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.payout.root)
    @ApiOperation({
        summary:
            'Выплата сотруднику направления service: движение PAYOUT + документ кассы RemOnline; при нулевом/отрицательном остатке или сумме больше остатка без confirmNegativeBalance — 409 с текущим остатком',
    })
    async create(@Body() body: CreatePayoutDto): Promise<PayoutResponse> {
        const command = new CreatePayoutCommand({
            employeeId: body.employeeId,
            amount: body.amount,
            occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
            comment: body.comment,
            createdBy: body.createdBy,
            confirmNegativeBalance: body.confirmNegativeBalance,
        });
        return this.commandBus.execute(command);
    }
}
