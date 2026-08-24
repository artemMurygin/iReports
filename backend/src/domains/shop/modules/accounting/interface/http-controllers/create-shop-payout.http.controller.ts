import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PayoutResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { CreateShopPayoutCommand } from '@/domains/shop/modules/accounting/application/command/create-shop-payout.command';
import { CreateShopPayoutDto } from '../dto/create-shop-payout.dto';

@ApiTags('Бухгалтерия: выплата магазина')
@Controller()
export class CreateShopPayoutHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.payout.root)
    @ApiOperation({
        summary:
            'Выплата сотруднику направления shop: движение PAYOUT + документ кассы МойСклад; при нулевом/отрицательном остатке или сумме больше остатка без confirmNegativeBalance — 409 с текущим остатком',
    })
    async create(@Body() body: CreateShopPayoutDto): Promise<PayoutResponse> {
        const command = new CreateShopPayoutCommand({
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
