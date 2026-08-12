import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { CloseAccountingPeriodCommand } from '@/domains/service/modules/accounting/application/command/close-accounting-period.command';
import { CloseAccountingPeriodDto } from '../dto/close-accounting-period.dto';

@ApiTags('Бухгалтерия: расчётный период')
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
