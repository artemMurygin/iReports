import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GetServicesAnalyticsResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { DateRange } from '@/shared/domain/date-range.value-object';
import { GetServicesAnalyticsQueryDto } from '../dto/get-services-analytics-query.dto';
import { GetServicesAnalyticsService } from '../../application/services/get-services-analytics.service';

// Новый дом для GET /reports/services-analytics из src/TODO/reports (Фаза
// 5, docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md)
// — в отличие от get-service-funnel-report.http.controller.ts (Фаза 4),
// легаси-эндпоинт при этом уже удалён вместе с остальным TODO/reports:
// перенос доводится до конца в этой же фазе, без параллельного маршрута.
@ApiTags('Отчёты')
@Controller()
export class GetServicesAnalyticsHttpController {
    constructor(
        private readonly getServicesAnalytics: GetServicesAnalyticsService,
    ) {}

    @Get(routesV1.service.reports.services)
    @ApiOperation({
        summary:
            'Аналитика проданных услуг за период с разбивкой по дням/неделям/месяцам',
    })
    async get(
        @Query() query: GetServicesAnalyticsQueryDto,
    ): Promise<GetServicesAnalyticsResponse> {
        const range = DateRange.create(query.from, query.to);
        return this.getServicesAnalytics.execute({
            range,
            groupBy: query.groupBy,
            categoryIds: query.categoryIds,
            serviceIds: query.serviceIds,
        });
    }
}
