import {
    Controller,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { RecalculateAccountingPeriodCommand } from '@/domains/service/modules/accounting/application/command/accounting-period/recalculate-accounting-period.command';

@ApiTags('Бухгалтерия: расчётный период')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:manage_period')
@Controller()
export class RecalculateAccountingPeriodHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Ручное «пересчитать» для руководителя (PRD раздел 4) — сбрасывает
    // кэш открытого периода, сам пересчёт ленивый (см. следующий запрос
    // отчёта — GetEmployeeSalaryReportService).
    @Post(routesV1.service.accounting.period.recalculate)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Сбросить кэш открытого расчётного периода' })
    async recalculate(@Param('period') period: string): Promise<void> {
        const command = new RecalculateAccountingPeriodCommand({
            direction: 'service',
            period,
        });
        await this.commandBus.execute(command);
    }
}
