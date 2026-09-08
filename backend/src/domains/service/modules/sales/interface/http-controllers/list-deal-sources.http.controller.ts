import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListDealSourcesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListDealCatalogService } from '../../application/services/list-deal-catalog.service';

// Новый дом для GET /deals/sources из src/TODO/deals (Фаза 2, см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md).
@ApiTags('Продажи')
@Controller()
export class ListDealSourcesHttpController {
    constructor(private readonly listDealCatalog: ListDealCatalogService) {}

    @Get(routesV1.service.deals.sources)
    @ApiOperation({ summary: 'Получить список источников сделок' })
    async list(): Promise<ListDealSourcesResponse> {
        return this.listDealCatalog.listSources();
    }
}
