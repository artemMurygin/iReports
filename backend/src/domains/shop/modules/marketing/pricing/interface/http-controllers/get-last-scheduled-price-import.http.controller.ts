import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { LastScheduledPriceImportResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { Public } from '@/shared/decorators/public.decorator';
import { GetLastScheduledPriceImportService } from '../../application/services/get-last-scheduled-price-import.service';

@ApiTags('Маркетинг: импорт цен магазина')
@Controller()
export class GetLastScheduledPriceImportHttpController {
    constructor(private readonly getLast: GetLastScheduledPriceImportService) {}

    // Public: вызывается из сайдбара Google Sheets, у которого нет Bitrix-сессии.
    @Public()
    @Get(routesV1.shop.marketing.pricing.lastScheduledImport)
    @ApiOperation({
        summary: 'Итог последней автоматической (по крону) выгрузки прайса',
    })
    last(): Promise<LastScheduledPriceImportResponse> {
        return this.getLast.execute();
    }
}
