import { Inject, Injectable } from '@nestjs/common';
import type { ListOrderTypesResponse } from 'ireports-contracts';
import { SERVICE_SALES_SOURCE } from '../ports/service-sales.port';
import type { ServiceSalesSourcePort } from '../ports/service-sales.port';
import { toOrderTypeResponse } from '../mappers/to-order-type-response';

// Read-side справочника типов заказов RoApp (GET /v1/service/reports/order-type,
// Фаза 1, docs/service-plan-salary-rule-order-category-filter/
// plan-service-plan-salary-rule-order-category-filter.md) — "категория заказа" в
// терминах этой фичи, используется как справочник значений для нового поля
// SalaryRule.orderTypeIds. По образцу ListServiceCategoriesService: без
// параметров, весь справочник целиком.
@Injectable()
export class ListOrderTypesService {
    constructor(
        @Inject(SERVICE_SALES_SOURCE)
        private readonly source: ServiceSalesSourcePort,
    ) {}

    async execute(): Promise<ListOrderTypesResponse> {
        const orderTypes = await this.source.listOrderTypes();
        return orderTypes.map(toOrderTypeResponse);
    }
}
