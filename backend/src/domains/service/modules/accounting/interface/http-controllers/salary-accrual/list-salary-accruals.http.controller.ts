import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualListResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListSalaryAccrualsService } from '@/domains/service/modules/accounting/application/services/salary-accrual/list-salary-accruals.service';
import { ListSalaryAccrualsQueryDto } from '../../dto/salary-accrual/list-salary-accruals-query.dto';

@ApiTags('Бухгалтерия: начисления зарплаты')
@Controller()
export class ListSalaryAccrualsHttpController {
    constructor(
        private readonly listSalaryAccruals: ListSalaryAccrualsService,
    ) {}

    @Get(routesV1.service.accounting.salaryAccruals.root)
    @ApiOperation({
        summary: 'Документы начисления зарплаты направления service за период',
    })
    async list(
        @Query() query: ListSalaryAccrualsQueryDto,
    ): Promise<SalaryAccrualListResponse> {
        return this.listSalaryAccruals.execute('service', query.period);
    }
}
