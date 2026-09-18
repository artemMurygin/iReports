import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { CloseAccountingPeriodDto } from '@/shared/interface/dto/close-accounting-period.dto';
import { CloseShopAccountingPeriodCommand } from '@/domains/shop/modules/accounting/application/command/accounting-period/close-accounting-period.command';

// Зеркало CloseAccountingPeriodHttpController (domains/service) — DTO тела
// запроса (closedBy) переиспользуется как есть, он не завязан на
// направление (см. close-accounting-period.dto.ts).
@ApiTags('Бухгалтерия: расчётный период магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:manage_period')
@Controller()
export class CloseShopAccountingPeriodHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.period.close)
    @ApiOperation({ summary: 'Закрыть расчётный период направления shop' })
    async close(
        @Param('period') period: string,
        @Body() body: CloseAccountingPeriodDto,
    ): Promise<AccountingPeriodResponse> {
        const command = new CloseShopAccountingPeriodCommand({
            period,
            closedBy: body.closedBy,
        });
        return this.commandBus.execute(command);
    }
}
