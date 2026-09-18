import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PayoutBatchResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { CreateShopPayoutBatchCommand } from '@/domains/shop/modules/accounting/application/command/cashbox-payout/create-payout-batch.command';
import { ShopPayoutBatchDto } from '../../dto/cashbox-payout/payout-batch.dto';

@ApiTags('Бухгалтерия: выплата магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:manage_payout')
@Controller()
export class CreateShopPayoutBatchHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.payout.batch)
    @ApiOperation({
        summary:
            '«Выплатить выбранным» направления shop: по каждому сотруднику — выплата на его остаток на момент операции; ответ — перечень успехов/ошибок/требующих подтверждения',
    })
    async batch(
        @Body() body: ShopPayoutBatchDto,
    ): Promise<PayoutBatchResponse> {
        const command = new CreateShopPayoutBatchCommand({
            employeeIds: body.employeeIds,
            occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
            comment: body.comment,
            createdBy: body.createdBy,
            confirmNegativeBalance: body.confirmNegativeBalance,
        });
        return this.commandBus.execute(command);
    }
}
