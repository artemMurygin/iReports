import type { GoodsTurnoverReportLineResponse } from 'ireports-contracts';
import { GoodsTurnoverReportLine } from '@/domains/service/modules/warehouse/domain/entities/goods-turnover-report/goods-turnover-report-line.entity';
import { ProductCategory } from '@/domains/service/modules/warehouse/domain/value-objects/product-category.value-object';
import { Warehouse } from '@/domains/service/modules/warehouse/domain/value-objects/warehouse.value-object';

// Денормализует строку отчёта именем/parentId категории и именем склада —
// см. GetGoodsTurnoverReportService (задача 10). `category`/`warehouse` —
// `undefined`, только если справочник разошёлся со строками уже
// построенного отчёта (запись удалена из RoApp уже после того, как отчёт
// был по ней построен) — оба справочника read-only и наполняются тем же
// синком, что и данные, из которых строится отчёт, поэтому на практике это
// защитный, а не ожидаемый путь. Пустая строка вместо падения — сознательный
// выбор: GET отчёта не должен переставать работать целиком из-за одной
// устаревшей позиции.
export function toGoodsTurnoverReportLineResponse(
    line: GoodsTurnoverReportLine,
    category: ProductCategory | undefined,
    warehouse: Warehouse | undefined,
): GoodsTurnoverReportLineResponse {
    return {
        categoryId: line.categoryId,
        categoryName: category?.getName() ?? '',
        categoryParentId: category?.getParentId() ?? null,
        warehouseId: line.warehouseId,
        warehouseName: warehouse?.getName() ?? '',
        outcomeQuantity: line.outcome.quantity,
        outcomeSum: line.outcome.sum,
        stockQuantity: line.stock.quantity,
        stockSum: line.stock.sum,
        turnoverRatio: line.turnoverRatio,
    };
}
