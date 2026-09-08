import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListDealsResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { DateRange } from '@/shared/domain/date-range.value-object';
import { ListDealsQueryDto } from '../dto/list-deals-query.dto';
import { ListDealsService } from '../../application/services/list-deals.service';

// Новый дом для GET /deals из src/TODO/deals (см. комментарий у
// serviceDealsRoot в app.routes.ts). Фаза 2 (см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md)
// удаляет src/TODO/deals целиком — этот путь остаётся единственным.
@ApiTags('Продажи')
@Controller()
export class ListDealsHttpController {
    constructor(private readonly listDeals: ListDealsService) {}

    @Get(routesV1.service.deals.root)
    @ApiOperation({ summary: 'Получить список сделок за период' })
    async list(@Query() query: ListDealsQueryDto): Promise<ListDealsResponse> {
        const range = DateRange.create(query.from, query.to);
        return this.listDeals.execute(range);
    }
}
