import { GoodsTurnoverReportLine } from '@/domains/shop/modules/warehouse/domain/entities/goods-turnover-report-line/goods-turnover-report-line.entity';
import { TurnoverCoefficient } from '@/domains/shop/modules/warehouse/domain/value-objects/turnover-coefficient.value-object';

// Плоская структура ответа отчёта по оборачиваемости (architecture.md,
// GetGoodsTurnoverReportService.getReport) — одна строка на пару
// «категория × склад». Денежные поля отдаются в копейках (см. Money,
// value-objects/money.value-object.ts), фронтенд форматирует их сам.
//
// Тип пока объявлен здесь, а не в ireports-contracts: контракт и HTTP-слой
// заводятся в следующей задаче (tasks.md группа 12/13) — при её выполнении
// этот интерфейс переезжает в contracts, а не дублируется вручную.
export interface GoodsTurnoverReportLineDto {
    categoryId: string;
    warehouseId: string;
    turnoverQuantity: number;
    turnoverSum: number;
    stockQuantity: number;
    stockSum: number;
    coefficient: number | null;
}

// implements design.md D8 of shop-turnover-report (null, а не 0, если
// коэффициент недоступен — см. TurnoverCoefficient.isAvailable()).
export function toGoodsTurnoverReportResponse(
    line: GoodsTurnoverReportLine,
    coefficient: TurnoverCoefficient,
): GoodsTurnoverReportLineDto {
    return {
        categoryId: line.categoryId,
        warehouseId: line.warehouseId,
        turnoverQuantity: line.turnoverQuantity,
        turnoverSum: line.turnoverSum.getValue(),
        stockQuantity: line.stockQuantity,
        stockSum: line.stockSum.getValue(),
        coefficient: coefficient.isAvailable() ? coefficient.getValue() : null,
    };
}
