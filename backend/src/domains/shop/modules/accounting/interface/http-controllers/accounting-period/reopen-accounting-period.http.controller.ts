import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ReopenShopAccountingPeriodCommand } from '@/domains/shop/modules/accounting/application/command/accounting-period/reopen-accounting-period.command';
import { ReopenShopAccountingPeriodDto } from '../../dto/accounting-period/reopen-accounting-period.dto';

// Повторное открытие закрытого расчётного периода направления shop — тонкий
// HTTP-слой поверх собственной, независимой ReopenShopAccountingPeriodCommand
// (Фаза 6 docs/service-shop-boundary-violations-fix) вместо generic по
// direction команды сервиса, переиспользовавшейся раньше (см. Фазу 5).
@ApiTags('Бухгалтерия: расчётный период магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:manage_period')
@Controller()
export class ReopenShopAccountingPeriodHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Тело обязано содержать { confirm: true } (см.
    // reopenAccountingPeriodRequestSchema) — явное подтверждение повторного
    // открытия проверяется на этой границе, раньше, чем запрос доходит до
    // домена (см. PRD: "требует явного подтверждения").
    @Post(routesV1.shop.accounting.period.reopen)
    @ApiOperation({
        summary: 'Повторно открыть закрытый расчётный период магазина',
    })
    async reopen(
        @Param('period') period: string,
        @Body() _body: ReopenShopAccountingPeriodDto,
    ): Promise<AccountingPeriodResponse> {
        const command = new ReopenShopAccountingPeriodCommand({ period });
        return this.commandBus.execute(command);
    }
}
