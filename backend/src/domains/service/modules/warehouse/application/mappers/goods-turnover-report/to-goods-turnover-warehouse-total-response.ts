import type { GoodsTurnoverWarehouseTotalResponse } from 'ireports-contracts';
import { GoodsTurnoverWarehouseTotal } from '@/domains/service/modules/warehouse/domain/value-objects/goods-turnover-warehouse-total.value-object';

// add-department-head-salary-rules, FR5: денормализует итоговую строку «по складу» в форму ответа
// GET .../goods-turnover-report/:period — см. GetGoodsTurnoverReportService.
export function toGoodsTurnoverWarehouseTotalResponse(
    total: GoodsTurnoverWarehouseTotal,
): GoodsTurnoverWarehouseTotalResponse {
    return {
        warehouseId: total.warehouseId,
        outcomeSum: total.outcomeSum,
        stockSum: total.stockSum,
        stockQuantity: total.stockQuantity,
        turnoverRatio: total.turnoverRatio,
    };
}
