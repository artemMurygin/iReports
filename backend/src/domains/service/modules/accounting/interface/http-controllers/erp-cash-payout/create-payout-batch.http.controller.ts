import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PayoutBatchResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { CreatePayoutBatchCommand } from '@/domains/service/modules/accounting/application/command/erp-cash-payout/create-payout-batch.command';
import { PayoutBatchDto } from '../../dto/erp-cash-payout/payout-batch.dto';

@ApiTags('Бухгалтерия: выплата')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:manage_payout')
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
