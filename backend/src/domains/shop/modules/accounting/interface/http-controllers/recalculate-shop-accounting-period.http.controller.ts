import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { RecalculateShopAccountingPeriodCommand } from '@/domains/shop/modules/accounting/application/command/recalculate-shop-accounting-period.command';

// Ручной сброс кэша открытого расчётного периода направления shop — тонкий
// HTTP-слой поверх собственной, независимой
// RecalculateShopAccountingPeriodCommand (Фаза 6
// docs/service-shop-boundary-violations-fix) вместо generic по direction
// команды сервиса, переиспользовавшейся раньше (см. Фазу 5). Сам пересчёт
// ленивый (см. следующий запрос отчёта —
// GetShopEmployeeSalaryReportService/GetShopDepartmentSalaryReportService).
@ApiTags('Бухгалтерия: расчётный период магазина')
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
