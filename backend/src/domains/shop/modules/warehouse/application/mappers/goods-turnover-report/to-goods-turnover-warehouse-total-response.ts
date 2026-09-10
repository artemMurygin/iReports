import { GoodsTurnoverWarehouseTotal } from '@/domains/shop/modules/warehouse/domain/value-objects/goods-turnover-warehouse-total.value-object';

// Плоская структура ответа итоговой строки «по складу» (add-department-head-salary-rules, FR5) —
// денежные поля отдаются в копейках, как и GoodsTurnoverReportLineDto (см. комментарий там);
// контракт (`shopGoodsTurnoverWarehouseTotalSchema`) переводит их в рубли через transform на
// стороне потребителя, а не здесь.
//
// Тип пока объявлен здесь, а не в ireports-contracts — по тому же образцу, что и
// GoodsTurnoverReportLineDto (см. комментарий в to-goods-turnover-report-response.ts); контракт для
// ответа уже существует (`shop-goods-turnover-report.ts`), этот DTO — внутренний промежуточный тип
// application-слоя перед сериализацией контроллером.
export interface GoodsTurnoverWarehouseTotalDto {
    warehouseId: string;
    turnoverSum: number;
    stockSum: number;
    stockQuantity: number;
    coefficient: number | null;
}

export function toGoodsTurnoverWarehouseTotalResponse(
    total: GoodsTurnoverWarehouseTotal,
): GoodsTurnoverWarehouseTotalDto {
    return {
        warehouseId: total.warehouseId,
        turnoverSum: total.turnoverSum,
        stockSum: total.stockSum,
        stockQuantity: total.stockQuantity,
        coefficient: total.coefficient,
    };
}
