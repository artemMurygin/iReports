import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PayoutResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { CreateShopPayoutCommand } from '@/domains/shop/modules/accounting/application/command/cashbox-payout/create-payout.command';
import { CreateShopPayoutDto } from '../../dto/cashbox-payout/create-payout.dto';

@ApiTags('Бухгалтерия: выплата магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:manage_payout')
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
