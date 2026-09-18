import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ReopenAccountingPeriodCommand } from '@/domains/service/modules/accounting/application/command/accounting-period/reopen-accounting-period.command';
import { ReopenAccountingPeriodDto } from '../../dto/accounting-period/reopen-accounting-period.dto';

@ApiTags('Бухгалтерия: расчётный период')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:manage_period')
@Controller()
export class ReopenAccountingPeriodHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Тело обязано содержать { confirm: true } (см.
    // reopenAccountingPeriodRequestSchema) — явное подтверждение повторного
    // открытия проверяется на этой границе, раньше, чем запрос доходит до
    // домена (см. PRD: "требует явного подтверждения").
    @Post(routesV1.service.accounting.period.reopen)
    @ApiOperation({ summary: 'Повторно открыть закрытый расчётный период' })
    async reopen(
        @Param('period') period: string,
        @Body() _body: ReopenAccountingPeriodDto,
    ): Promise<AccountingPeriodResponse> {
        const command = new ReopenAccountingPeriodCommand({
            direction: 'service',
            period,
        });
        return this.commandBus.execute(command);
    }
}
