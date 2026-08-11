import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { RecalculateAccountingPeriodCommand } from '@/domains/service/modules/accounting/application/command/recalculate-accounting-period.command';
import { parseAccountingDirection } from '../utils/parse-accounting-direction';

@Controller('accounting')
export class RecalculateAccountingPeriodHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Ручное «пересчитать» для руководителя (PRD раздел 4) — сбрасывает
    // кэш открытого периода, сам пересчёт ленивый (см. следующий запрос
    // отчёта — GetEmployeeSalaryReportService).
    @Post('period/:direction/:period/recalculate')
    @HttpCode(HttpStatus.NO_CONTENT)
    async recalculate(
        @Param('direction') direction: string,
        @Param('period') period: string,
    ): Promise<void> {
        const command = new RecalculateAccountingPeriodCommand({
            direction: parseAccountingDirection(direction),
            period,
        });
        await this.commandBus.execute(command);
    }
}
