import { Body, Controller, Post, Query } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccruePeriodSalaryAccrualsResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { AccruePeriodSalaryAccrualsCommand } from '@/domains/service/modules/accounting/application/command/salary-accrual/accrue-period-salary-accruals.command';
import { AccrueSalaryAccrualLineDto } from '../../dto/salary-accrual/accrue-salary-accrual-line.dto';
import { ListSalaryAccrualsQueryDto } from '../../dto/salary-accrual/list-salary-accruals-query.dto';

@ApiTags('Бухгалтерия: начисления зарплаты')
@Controller()
export class AccruePeriodSalaryAccrualsHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.accounting.salaryAccruals.accrueAll)
    @ApiOperation({
        summary:
            '«Начислить все документы месяца» (service): построчное проведение всех документов периода, ответ — статистика и перечень ошибок',
    })
    async accrue(
        @Query() query: ListSalaryAccrualsQueryDto,
        @Body() body: AccrueSalaryAccrualLineDto,
    ): Promise<AccruePeriodSalaryAccrualsResponse> {
        const command = new AccruePeriodSalaryAccrualsCommand({
            direction: 'service',
            period: query.period,
            accruedBy: body.accruedBy,
        });
        return this.commandBus.execute(command);
    }
}
