import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DepartmentBalancesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetDepartmentBalancesService } from '@/modules/employee-balance/application/services/get-department-balances.service';

@ApiTags('Бухгалтерия: баланс сотрудника')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('employee-balance:view_all')
@Controller()
export class GetDepartmentBalancesHttpController {
    constructor(
        private readonly getDepartmentBalances: GetDepartmentBalancesService,
    ) {}

    @Get(routesV1.accounting.balance.department)
    @ApiOperation({
        summary:
            'Сводка общих балансов по отделу за месяц: остаток/начислено/авансы/ручные по сотрудникам текущего отдела Bitrix24 и итог',
    })
    async get(
        @Param('id', ParseIntPipe) id: number,
        @Param('period') period: string,
    ): Promise<DepartmentBalancesResponse> {
        return this.getDepartmentBalances.execute(id, period);
    }
}
