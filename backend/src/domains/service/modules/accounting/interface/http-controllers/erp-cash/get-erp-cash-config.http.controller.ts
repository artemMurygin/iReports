import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ErpCashConfigResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetErpCashConfigService } from '@/domains/service/modules/accounting/application/services/erp-cash/get-erp-cash-config.service';

@ApiTags('Бухгалтерия: касса ERP')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:view')
@Controller()
export class GetErpCashConfigHttpController {
    constructor(private readonly getErpCashConfig: GetErpCashConfigService) {}

    @Get(routesV1.service.accounting.erpCashConfig)
    @ApiOperation({
        summary: 'Конфигурация кассы RemOnline направления service',
    })
    async get(): Promise<ErpCashConfigResponse> {
        return this.getErpCashConfig.execute('service');
    }
}
