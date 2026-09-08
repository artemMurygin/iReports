import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListServiceCategoriesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListServiceCategoriesService } from '../../application/services/list-service-categories.service';

// Новый дом для GET /reports/service-categories из src/TODO/reports (Фаза
// 5, см. комментарий в get-services-analytics.http.controller.ts).
@ApiTags('Отчёты')
@Controller()
export class ListServiceCategoriesHttpController {
    constructor(
        private readonly listServiceCategories: ListServiceCategoriesService,
    ) {}

    @Get(routesV1.service.reports.serviceCategories)
    @ApiOperation({ summary: 'Список категорий услуг' })
    async get(): Promise<ListServiceCategoriesResponse> {
        return this.listServiceCategories.execute();
    }
}
