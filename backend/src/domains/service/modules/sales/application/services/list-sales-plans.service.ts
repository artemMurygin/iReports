import { Injectable } from '@nestjs/common';
import type { SalesPlanResponse } from 'ireports-contracts';
import { EnsureSalesPlansForPeriodService } from './ensure-sales-plans-for-period.service';
import type { SalesDirection } from '../../domain/types/sales-plan.types';
import { toSalesPlanResponse } from '../mappers/to-sales-plan-response';

// "План месяца" всегда просматривается в разрезе направления и периода
// (см. пользовательский сценарий PRD "руководитель открывает план месяца"),
// поэтому оба параметра обязательны — в отличие от шаблона, у которого
// естественная область видимости шире.
//
// Это же первое обращение к периоду — точка ленивого достраивания (Фаза 4):
// EnsureSalesPlansForPeriodService.ensure() гарантирует, что план месяца не
// пустой, прежде чем список будет прочитан. @ProdCron первого числа не
// тикает в dev — без этого вызова план в dev-среде был бы пустым до первого
// ручного создания строки.
@Injectable()
export class ListSalesPlansService {
    constructor(
        private readonly ensureSalesPlans: EnsureSalesPlansForPeriodService,
    ) {}

    async execute(
        direction: SalesDirection,
        period: string,
    ): Promise<SalesPlanResponse[]> {
        const plans = await this.ensureSalesPlans.ensure(direction, period);
        return plans.map(toSalesPlanResponse);
    }
}
