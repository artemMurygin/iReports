import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListDealStageGroupsResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListDealCatalogService } from '../../application/services/list-deal-catalog.service';

// Новый дом для GET /deals/stage-groups из src/TODO/deals (Фаза 2, см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md).
@ApiTags('Продажи')
@Controller()
export class ListDealStageGroupsHttpController {
    constructor(private readonly listDealCatalog: ListDealCatalogService) {}

    @Get(routesV1.service.deals.stageGroups)
    @ApiOperation({ summary: 'Получить список групп этапов сделок' })
    async list(): Promise<ListDealStageGroupsResponse> {
        return this.listDealCatalog.listStageGroups();
    }
}
