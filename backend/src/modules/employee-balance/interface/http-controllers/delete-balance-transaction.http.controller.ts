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
import { DeleteBalanceTransactionCommand } from '@/modules/employee-balance/application/command/delete-balance-transaction.command';

@ApiTags('Бухгалтерия: баланс сотрудника')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('employee-balance:edit')
@Controller()
export class DeleteBalanceTransactionHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.accounting.balance.transactionById)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:
            'Удаление ошибочного ручного движения без документа ERP: запись исчезает из ленты, остаток пересчитывается; движение начисления или с документом ERP → 409',
    })
    async delete(@Param('id') id: string): Promise<void> {
        await this.commandBus.execute(
            new DeleteBalanceTransactionCommand({ transactionId: id }),
        );
    }
}
