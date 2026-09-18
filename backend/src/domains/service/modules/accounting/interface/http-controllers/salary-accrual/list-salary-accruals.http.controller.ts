import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalaryAccrualListResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListSalaryAccrualsService } from '@/domains/service/modules/accounting/application/services/salary-accrual/list-salary-accruals.service';
import { ListSalaryAccrualsQueryDto } from '../../dto/salary-accrual/list-salary-accruals-query.dto';

@ApiTags('Бухгалтерия: начисления зарплаты')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:view_accrual')
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
