import { Body, Controller, Param, Post } from '@nestjs/common';
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
