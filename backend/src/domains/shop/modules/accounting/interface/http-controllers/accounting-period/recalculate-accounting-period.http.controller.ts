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
import { RecalculateShopAccountingPeriodCommand } from '@/domains/shop/modules/accounting/application/command/accounting-period/recalculate-accounting-period.command';

// Ручной сброс кэша открытого расчётного периода направления shop — тонкий
// HTTP-слой поверх собственной, независимой
// RecalculateShopAccountingPeriodCommand (Фаза 6
// docs/service-shop-boundary-violations-fix) вместо generic по direction
// команды сервиса, переиспользовавшейся раньше (см. Фазу 5). Сам пересчёт
// ленивый (см. следующий запрос отчёта —
// GetShopEmployeeSalaryReportService/GetShopDepartmentSalaryReportService).
@ApiTags('Бухгалтерия: расчётный период магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:manage_period')
@Controller()
export class RecalculateShopAccountingPeriodHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.period.recalculate)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Сбросить кэш открытого расчётного периода магазина',
    })
    async recalculate(@Param('period') period: string): Promise<void> {
        const command = new RecalculateShopAccountingPeriodCommand({
            period,
        });
        await this.commandBus.execute(command);
    }
}
