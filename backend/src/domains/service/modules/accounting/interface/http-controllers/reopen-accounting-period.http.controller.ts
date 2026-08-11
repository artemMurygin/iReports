import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { ReopenAccountingPeriodCommand } from '@/domains/service/modules/accounting/application/command/reopen-accounting-period.command';
import { parseAccountingDirection } from '../utils/parse-accounting-direction';
import { ReopenAccountingPeriodDto } from '../dto/reopen-accounting-period.dto';

@Controller('accounting')
export class ReopenAccountingPeriodHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Тело обязано содержать { confirm: true } (см.
    // reopenAccountingPeriodRequestSchema) — явное подтверждение повторного
    // открытия проверяется на этой границе, раньше, чем запрос доходит до
    // домена (см. PRD: "требует явного подтверждения").
    @Post('period/:direction/:period/reopen')
    async reopen(
        @Param('direction') direction: string,
        @Param('period') period: string,
        @Body() _body: ReopenAccountingPeriodDto,
    ): Promise<AccountingPeriodResponse> {
        const command = new ReopenAccountingPeriodCommand({
            direction: parseAccountingDirection(direction),
            period,
        });
        return this.commandBus.execute(command);
    }
}
