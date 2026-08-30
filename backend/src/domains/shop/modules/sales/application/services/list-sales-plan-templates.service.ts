import { Inject, Injectable } from '@nestjs/common';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { SHOP_SALES_PLAN_TEMPLATE_REPOSITORY } from '../ports/sales-plan-template.port';
import type { ShopSalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import { toShopSalesPlanTemplateResponse } from '../mappers/to-sales-plan-template-response';

// Зеркало domains/service/modules/sales/application/services/
// list-sales-plan-templates.service.ts (Фаза 7).
@Injectable()
export class ListShopSalesPlanTemplatesService {
    constructor(
        @Inject(SHOP_SALES_PLAN_TEMPLATE_REPOSITORY)
        private readonly repo: ShopSalesPlanTemplateRepositoryPort,
    ) {}

    async execute(): Promise<SalesPlanTemplateResponse[]> {
        const templates = await this.repo.findAll();
        return templates.map(toShopSalesPlanTemplateResponse);
    }
}
