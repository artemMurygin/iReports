import { Inject, Injectable } from '@nestjs/common';
import type { SalesPlanResponse } from 'ireports-contracts';
import { SALES_PLAN_REPOSITORY } from '../ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '../ports/sales-plan.port';
import type { SalesDirection } from '../../domain/types/sales-plan.types';
import { toSalesPlanResponse } from '../mappers/to-sales-plan-response';

// "План месяца" всегда просматривается в разрезе направления и периода
// (см. пользовательский сценарий PRD "руководитель открывает план месяца"),
// поэтому оба параметра обязательны — в отличие от шаблона, у которого
// естественная область видимости шире.
@Injectable()
export class ListSalesPlansService {
    constructor(
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly repo: SalesPlanRepositoryPort,
    ) {}

    async execute(
        direction: SalesDirection,
        period: string,
    ): Promise<SalesPlanResponse[]> {
        const plans = await this.repo.findByDirectionAndPeriod(
            direction,
            period,
        );
        return plans.map(toSalesPlanResponse);
    }
}
