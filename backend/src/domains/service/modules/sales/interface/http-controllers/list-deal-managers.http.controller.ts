import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListDealManagersResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListDealCatalogService } from '../../application/services/list-deal-catalog.service';

// Новый дом для GET /deals/managers из src/TODO/deals (Фаза 2, см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md).
// Легаси-версия делала N+1 (findFirst на каждого менеджера) —
// DealCatalogRepository.findManagers заменяет это одним батч-запросом (см.
// комментарий там же).
@ApiTags('Продажи')
@Controller()
export class ListDealManagersHttpController {
    constructor(private readonly listDealCatalog: ListDealCatalogService) {}

    @Get(routesV1.service.deals.managers)
    @ApiOperation({ summary: 'Получить список менеджеров сделок' })
    async list(): Promise<ListDealManagersResponse> {
        return this.listDealCatalog.listManagers();
    }
}
