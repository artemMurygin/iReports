import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListDealStagesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListDealCatalogService } from '../../application/services/list-deal-catalog.service';

// Новый дом для GET /deals/stages из src/TODO/deals (Фаза 2, см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md).
@ApiTags('Продажи')
@Controller()
export class ListDealStagesHttpController {
    constructor(private readonly listDealCatalog: ListDealCatalogService) {}

    @Get(routesV1.service.deals.stages)
    @ApiOperation({ summary: 'Получить список этапов сделок' })
    async list(): Promise<ListDealStagesResponse> {
        return this.listDealCatalog.listStages();
    }
}
