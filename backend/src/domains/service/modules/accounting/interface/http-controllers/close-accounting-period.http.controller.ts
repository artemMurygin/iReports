import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { CloseAccountingPeriodCommand } from '@/domains/service/modules/accounting/application/command/close-accounting-period.command';
import { parseAccountingDirection } from '../utils/parse-accounting-direction';
import { CloseAccountingPeriodDto } from '../dto/close-accounting-period.dto';

@Controller('accounting')
export class CloseAccountingPeriodHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post('period/:direction/:period/close')
    async close(
        @Param('direction') direction: string,
        @Param('period') period: string,
        @Body() body: CloseAccountingPeriodDto,
    ): Promise<AccountingPeriodResponse> {
        const command = new CloseAccountingPeriodCommand({
            direction: parseAccountingDirection(direction),
            period,
            closedBy: body.closedBy,
        });
        return this.commandBus.execute(command);
    }
}
