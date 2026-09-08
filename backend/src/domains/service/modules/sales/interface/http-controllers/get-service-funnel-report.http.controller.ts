import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GetServiceFunnelReportResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { DateRange } from '@/shared/domain/date-range.value-object';
import { GetServiceFunnelReportQueryDto } from '../dto/get-service-funnel-report-query.dto';
import { GetServiceFunnelReportService } from '../../application/services/get-service-funnel-report.service';

// Новый дом для GET /reports/service-funnel из src/TODO/reports (см.
// комментарий у serviceFunnelReportRoot в app.routes.ts) — легаси-эндпоинт
// при этом не трогается и продолжает работать, это параллельный маршрут на
// время миграции (Фаза 4,
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md).
@ApiTags('Продажи')
@Controller()
export class GetServiceFunnelReportHttpController {
    constructor(
        private readonly getServiceFunnelReport: GetServiceFunnelReportService,
    ) {}

    @Get(routesV1.service.funnelReport.root)
    @ApiOperation({ summary: 'Получить отчёт по воронке сервисных сделок' })
    async get(
        @Query() query: GetServiceFunnelReportQueryDto,
    ): Promise<GetServiceFunnelReportResponse> {
        const range = DateRange.create(query.from, query.to);
        return this.getServiceFunnelReport.execute({
            range,
            sourceIds: query.sourceIds,
            managerIds: query.managerIds,
            modelIds: query.modelIds,
            stageIds: query.stageIds,
            stageGroupIds: query.stageGroupIds,
        });
    }
}
