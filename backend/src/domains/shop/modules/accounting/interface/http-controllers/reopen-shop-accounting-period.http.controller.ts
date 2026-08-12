import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ReopenAccountingPeriodCommand } from '@/domains/service/modules/accounting/application/command/reopen-accounting-period.command';
import { ReopenAccountingPeriodDto } from '@/domains/service/modules/accounting/interface/dto/reopen-accounting-period.dto';

// Повторное открытие закрытого расчётного периода направления shop —
// тонкий HTTP-слой поверх generic по direction ReopenAccountingPeriodCommand
// модуля accounting сервиса (см. domains/service/CLAUDE.md), с собственным
// путём под /v1/shop (см. routesV1.shop.accounting.period.reopen).
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
        @Body() _body: ReopenAccountingPeriodDto,
    ): Promise<AccountingPeriodResponse> {
        const command = new ReopenAccountingPeriodCommand({
            direction: 'shop',
            period,
        });
        return this.commandBus.execute(command);
    }
}
