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
import { DeletePayoutCommand } from '@/domains/service/modules/accounting/application/command/erp-cash-payout/delete-payout.command';

@ApiTags('Бухгалтерия: выплата')
@Controller()
export class DeletePayoutHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.service.accounting.payout.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Удаление выплаты направления service: сначала удаление документа в кассе RemOnline, затем в одной транзакции — движение с баланса и возврат затронутых документов начисления из PAID в ACCRUED; отказ ERP — ничего не меняется',
    })
    async delete(@Param('id') id: string): Promise<void> {
        await this.commandBus.execute(
            new DeletePayoutCommand({ payoutId: id }),
        );
    }
}
