import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListDealDeviceTypesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListDealCatalogService } from '../../application/services/list-deal-catalog.service';

// Новый дом для GET /deals/models из src/TODO/deals (Фаза 2, см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md).
// Путь /models сохранён как есть (легаси-имя для getDeviceTypes, см.
// комментарий у routesV1.service.deals.models в app.routes.ts).
@ApiTags('Продажи')
@Controller()
export class ListDealDeviceTypesHttpController {
    constructor(private readonly listDealCatalog: ListDealCatalogService) {}

    @Get(routesV1.service.deals.models)
    @ApiOperation({ summary: 'Получить список моделей устройств сделок' })
    async list(): Promise<ListDealDeviceTypesResponse> {
        return this.listDealCatalog.listDeviceTypes();
    }
}
