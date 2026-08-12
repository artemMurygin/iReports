import { Inject, Injectable } from '@nestjs/common';
import type { ListServiceCategoriesResponse } from 'ireports-contracts';
import { SERVICE_SALES_SOURCE } from '../ports/service-sales.port';
import type { ServiceSalesSourcePort } from '../ports/service-sales.port';
import { toServiceCategoryResponse } from '../mappers/to-service-category-response';

// Read-side справочника категорий услуг (GET /v1/service/reports/service-categories)
// — перенос ReportsService.getServiceCategories (src/TODO/reports/
// reports.service.ts): без параметров, тот же orderBy (depth asc, name asc).
@Injectable()
export class ListServiceCategoriesService {
    constructor(
        @Inject(SERVICE_SALES_SOURCE)
        private readonly source: ServiceSalesSourcePort,
    ) {}

    async execute(): Promise<ListServiceCategoriesResponse> {
        const categories = await this.source.listCategories();
        return categories.map(toServiceCategoryResponse);
    }
}
