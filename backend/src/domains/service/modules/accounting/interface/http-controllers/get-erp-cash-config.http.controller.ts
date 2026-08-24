import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ErpCashConfigResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetErpCashConfigService } from '@/domains/service/modules/accounting/application/services/get-erp-cash-config.service';

@ApiTags('Бухгалтерия: касса ERP')
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
