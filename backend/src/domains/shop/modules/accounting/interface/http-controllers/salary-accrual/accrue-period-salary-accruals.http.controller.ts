import { Body, Controller, Post, Query } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccruePeriodSalaryAccrualsResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AccruePeriodShopSalaryAccrualsCommand } from '@/domains/shop/modules/accounting/application/command/salary-accrual/accrue-period-salary-accruals.command';
import { AccrueShopSalaryAccrualLineDto } from '../../dto/salary-accrual/accrue-salary-accrual-line.dto';
import { ListShopSalaryAccrualsQueryDto } from '../../dto/salary-accrual/list-salary-accruals-query.dto';

// «Начислить все документы месяца» магазина — тонкий HTTP-слой поверх
// собственной, независимой AccruePeriodShopSalaryAccrualsCommand (Фаза 6
// docs/service-shop-boundary-violations-fix) вместо generic по direction
// команды сервиса.
@ApiTags('Бухгалтерия: начисления зарплаты магазина')
@Controller()
export class AccruePeriodShopSalaryAccrualsHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.accounting.salaryAccruals.accrueAll)
    @ApiOperation({
        summary:
            '«Начислить все документы месяца» (shop): построчное проведение всех документов периода, ответ — статистика и перечень ошибок',
    })
    async accrue(
        @Query() query: ListShopSalaryAccrualsQueryDto,
        @Body() body: AccrueShopSalaryAccrualLineDto,
    ): Promise<AccruePeriodSalaryAccrualsResponse> {
        const command = new AccruePeriodShopSalaryAccrualsCommand({
            period: query.period,
            accruedBy: body.accruedBy,
        });
        return this.commandBus.execute(command);
    }
}
