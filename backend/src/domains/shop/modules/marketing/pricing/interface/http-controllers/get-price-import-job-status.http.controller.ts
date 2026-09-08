import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { PriceImportJobStatusResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetPriceImportJobStatusService } from '../../application/services/get-price-import-job-status.service';

// Новый дом GET /price-monitoring/:uuid/status из
// backend/src/TODO/priceMonitoring (Фаза 10) — разовый снапшот статуса,
// в отличие от SSE-эндпоинта ниже (subscribe-price-import-job-progress
// .http.controller.ts) не держит соединение открытым, для клиентов без
// поддержки EventSource (легаси-контроллер отдавал `JobProgressEvent`
// напрямую из PriceMonitoringProgressService — здесь то же самое,
// но снапшот всего агрегата PriceImportJob через общий маппер, см.
// toPriceImportJobStatusResponse).
@ApiTags('Маркетинг: импорт цен магазина')
@Controller()
export class GetPriceImportJobStatusHttpController {
    constructor(private readonly getStatus: GetPriceImportJobStatusService) {}

    @Get(routesV1.shop.marketing.pricing.importCostsStatus)
    @ApiOperation({ summary: 'Снапшот статуса и прогресса джобы импорта цен' })
    @ApiParam({
        name: 'id',
        description: 'id джобы (см. ответ POST .../import-costs)',
    })
    status(@Param('id') id: string): PriceImportJobStatusResponse {
        return this.getStatus.execute(id);
    }
}
