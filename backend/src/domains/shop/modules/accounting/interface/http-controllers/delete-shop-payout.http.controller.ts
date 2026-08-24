import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { DeleteShopPayoutCommand } from '@/domains/shop/modules/accounting/application/command/delete-shop-payout.command';

@ApiTags('Бухгалтерия: выплата магазина')
@Controller()
export class DeleteShopPayoutHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.shop.accounting.payout.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Удаление выплаты направления shop: сначала удаление документа в кассе МойСклад, затем в одной транзакции — движение с баланса и возврат затронутых документов начисления из PAID в ACCRUED; отказ ERP — ничего не меняется',
    })
    async delete(@Param('id') id: string): Promise<void> {
        await this.commandBus.execute(
            new DeleteShopPayoutCommand({ payoutId: id }),
        );
    }
}
