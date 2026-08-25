import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListOrderTypesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListOrderTypesService } from '../../application/services/list-order-types.service';

// Справочник типов заказов RoApp (Фаза 1, docs/
// service-plan-salary-rule-order-category-filter/
// plan-service-plan-salary-rule-order-category-filter.md) — "категория заказа"
// в терминах этой фичи, по образцу list-service-categories.http.controller.ts.
@ApiTags('Отчёты')
@Controller()
export class ListOrderTypesHttpController {
    constructor(private readonly listOrderTypes: ListOrderTypesService) {}

    @Get(routesV1.service.reports.orderType)
    @ApiOperation({ summary: 'Список типов заказов' })
    async get(): Promise<ListOrderTypesResponse> {
        return this.listOrderTypes.execute();
    }
}
