import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
    UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { DeletePayoutCommand } from '@/domains/service/modules/accounting/application/command/erp-cash-payout/delete-payout.command';

@ApiTags('Бухгалтерия: выплата')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:manage_payout')
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
