import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { StartPriceImportResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { StartPriceImportDto } from '../dto/start-price-import.dto';
import { StartPriceImportCommand } from '../../application/command/start-price-import.command';

// Новый дом POST /price-monitoring/update-shop-products-costs из
// backend/src/TODO/priceMonitoring (см. комментарий у
// shopMarketingPricingRoot в app.routes.ts) — легаси-эндпоинт удаляется этой
// же фазой (Фаза 10, docs/todo-modules-ddd-refactoring), в отличие от
// предыдущих фаз рефакторинга нет периода параллельной работы двух путей.
//
// Fire-and-forget, как и легаси-контроллер: `void this.commandBus.execute(...)`
// не дожидается завершения всего пайплайна (парсинг → AI → МойСклад →
// Sheets, см. StartPriceImportHandler) — клиент сразу получает `{ id }` и
// дальше следит за прогрессом через `GET .../import-costs/:id/status` или
// SSE `GET .../import-costs/:id`. `id` в ответе — `command.id` (Command.id,
// базовый класс), тот же id, который хендлер использует для самого
// агрегата `PriceImportJob` (см. StartPriceImportHandler.execute) — иначе
// ответ контроллера и id, под которым джоба реально появится в
// PRICE_IMPORT_JOB_STORE, могли бы разойтись.
@ApiTags('Маркетинг: импорт цен магазина')
@Controller()
export class StartPriceImportHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.marketing.pricing.importCosts)
    @ApiOperation({
        summary: 'Запустить импорт закупочных цен магазина из XLSX-прайса',
    })
    start(@Body() body: StartPriceImportDto): StartPriceImportResponse {
        const command = new StartPriceImportCommand({ fileBase64: body.file });
        void this.commandBus.execute(command);
        return { id: command.id };
    }
}
