import { Inject, Injectable } from '@nestjs/common';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { SALES_PLAN_TEMPLATE_REPOSITORY } from '../ports/sales-plan-template.port';
import type { SalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import type { SalesDirection } from '../../domain/types/sales-plan.types';
import { toSalesPlanTemplateResponse } from '../mappers/to-sales-plan-template-response';

@Injectable()
export class ListSalesPlanTemplatesService {
    constructor(
        @Inject(SALES_PLAN_TEMPLATE_REPOSITORY)
        private readonly repo: SalesPlanTemplateRepositoryPort,
    ) {}

    async execute(
        direction?: SalesDirection,
    ): Promise<SalesPlanTemplateResponse[]> {
        const templates = await this.repo.findAll(direction);
        return templates.map(toSalesPlanTemplateResponse);
    }
}
