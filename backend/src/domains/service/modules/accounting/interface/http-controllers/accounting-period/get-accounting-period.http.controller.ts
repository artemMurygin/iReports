import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetAccountingPeriodService } from '@/domains/service/modules/accounting/application/services/accounting-period/get-accounting-period.service';

@ApiTags('Бухгалтерия: расчётный период')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:view')
@Controller()
export class GetAccountingPeriodHttpController {
    constructor(
        private readonly getAccountingPeriod: GetAccountingPeriodService,
    ) {}

    @Get(routesV1.service.accounting.period.byPeriod)
    @ApiOperation({ summary: 'Статус расчётного периода' })
    async get(
        @Param('period') period: string,
    ): Promise<AccountingPeriodResponse> {
        return this.getAccountingPeriod.execute('service', period);
    }
}
