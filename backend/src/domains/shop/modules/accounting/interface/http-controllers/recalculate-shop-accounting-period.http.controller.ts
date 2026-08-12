import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { RecalculateAccountingPeriodCommand } from '@/domains/service/modules/accounting/application/command/recalculate-accounting-period.command';

// Ручной сброс кэша открытого расчётного периода направления shop —
// тонкий HTTP-слой поверх generic по direction
// RecalculateAccountingPeriodCommand модуля accounting сервиса (см.
// domains/service/CLAUDE.md), с собственным путём под /v1/shop (см.
// routesV1.shop.accounting.period.recalculate). Сам пересчёт ленивый (см.
// следующий запрос отчёта — GetEmployeeSalaryReportService/
// GetDepartmentSalaryReportService).
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
        const command = new RecalculateAccountingPeriodCommand({
            direction: 'shop',
            period,
        });
        await this.commandBus.execute(command);
    }
}
