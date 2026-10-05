import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { CancelPriceImportResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { Public } from '@/shared/decorators/public.decorator';
import { CancelPriceImportJobService } from '../../application/services/cancel-price-import-job.service';

@ApiTags('Маркетинг: импорт цен магазина')
@Controller()
export class CancelPriceImportJobHttpController {
    constructor(private readonly cancelJob: CancelPriceImportJobService) {}

    // Public: вызывается из Google Apps Script, у которого нет Bitrix-сессии.
    @Public()
    @Post(routesV1.shop.marketing.pricing.importCostsCancel)
    @HttpCode(200)
    @ApiOperation({
        summary:
            'Отменить джобу импорта цен и оборвать запросы к LLM (409 — завершена или идёт запись в МойСклад)',
    })
    @ApiParam({
        name: 'id',
        description: 'id джобы (см. ответ POST .../import-costs)',
    })
    cancel(@Param('id') id: string): CancelPriceImportResponse {
        return this.cancelJob.execute(id);
    }
}
