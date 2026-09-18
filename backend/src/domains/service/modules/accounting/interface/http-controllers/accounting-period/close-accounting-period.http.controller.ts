import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { CloseAccountingPeriodCommand } from '@/domains/service/modules/accounting/application/command/accounting-period/close-accounting-period.command';
import { CloseAccountingPeriodDto } from '@/shared/interface/dto/close-accounting-period.dto';

@ApiTags('Бухгалтерия: расчётный период')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:manage_period')
@Controller()
export class CloseAccountingPeriodHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.period.close)
    @ApiOperation({ summary: 'Закрыть расчётный период направления' })
    async close(
        @Param('period') period: string,
        @Body() body: CloseAccountingPeriodDto,
    ): Promise<AccountingPeriodResponse> {
        const command = new CloseAccountingPeriodCommand({
            period,
            closedBy: body.closedBy,
        });
        return this.commandBus.execute(command);
    }
}
