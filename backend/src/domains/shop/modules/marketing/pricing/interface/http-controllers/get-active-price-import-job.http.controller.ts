import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ActivePriceImportJobResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { Public } from '@/shared/decorators/public.decorator';
import { GetActivePriceImportJobService } from '../../application/services/get-active-price-import-job.service';

@ApiTags('Маркетинг: импорт цен магазина')
@Controller()
export class GetActivePriceImportJobHttpController {
    constructor(private readonly getActive: GetActivePriceImportJobService) {}

    // Public: вызывается из сайдбара Google Sheets, у которого нет Bitrix-сессии.
    @Public()
    @Get(routesV1.shop.marketing.pricing.activeImportCosts)
    @ApiOperation({
        summary: 'id выполняющейся джобы импорта цен (или null)',
    })
    active(): ActivePriceImportJobResponse {
        return this.getActive.execute();
    }
}
