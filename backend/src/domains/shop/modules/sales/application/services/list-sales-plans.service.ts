import { Injectable } from '@nestjs/common';
import type { SalesPlanResponse } from 'ireports-contracts';
import { EnsureShopSalesPlansForPeriodService } from './ensure-sales-plans-for-period.service';
import { toShopSalesPlanResponse } from '../mappers/to-sales-plan-response';

// Зеркало domains/service/modules/sales/application/services/
// list-sales-plans.service.ts (Фаза 7). Первое обращение к периоду — точка
// ленивого достраивания (см. EnsureShopSalesPlansForPeriodService):
// @ProdCron первого числа не тикает в dev — без этого вызова план в
// dev-среде был бы пустым до первого ручного создания строки.
@Injectable()
export class ListShopSalesPlansService {
    constructor(
        private readonly ensureSalesPlans: EnsureShopSalesPlansForPeriodService,
    ) {}

    async execute(period: string): Promise<SalesPlanResponse[]> {
        // ensureOrdered — те же строки, что и ensure(), но уже
        // отсортированные по сохранённому глобальному порядку строк (см.
        // EnsureShopSalesPlansForPeriodService.ensureOrdered, Фаза 4
        // docs/sales-plan-row-drag-and-drop-reorder), с sortOrder на каждой
        // строке для ответа.
        const ordered = await this.ensureSalesPlans.ensureOrdered(period);
        return ordered.map(({ plan, sortOrder }) =>
            toShopSalesPlanResponse(plan, sortOrder),
        );
    }
}
