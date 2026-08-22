import { Body, Controller, Post, Query } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccruePeriodSalaryAccrualsResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AccruePeriodSalaryAccrualsCommand } from '@/domains/service/modules/accounting/application/command/accrue-period-salary-accruals.command';
import { AccrueSalaryAccrualLineDto } from '@/domains/service/modules/accounting/interface/dto/accrue-salary-accrual-line.dto';
import { ListShopSalaryAccrualsQueryDto } from '../dto/list-shop-salary-accruals-query.dto';

// «Начислить все документы месяца» магазина — тонкий HTTP-слой поверх
// generic по direction AccruePeriodSalaryAccrualsCommand (общий CommandBus,
// хендлер зарегистрирован в AccountingModule сервиса).
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
        @Body() body: AccrueSalaryAccrualLineDto,
    ): Promise<AccruePeriodSalaryAccrualsResponse> {
        const command = new AccruePeriodSalaryAccrualsCommand({
            direction: 'shop',
            period: query.period,
            accruedBy: body.accruedBy,
        });
        return this.commandBus.execute(command);
    }
}
