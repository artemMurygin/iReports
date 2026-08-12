import { ServiceSaleEntity } from '../entities/service-sale.entity';
import { ServiceMetrics } from '../value-objects/service-metrics.value-object';

// Перенос calcServiceMetrics (src/TODO/reports/reports.service.ts) без
// изменения бизнес-правила (см. "Не в скоупе" PRD: "изменение бизнес-логики
// ... переносится как есть"). rows — все строки "услуга × заказ" ОДНОЙ
// услуги за период (вызывающий код группирует по serviceId, см.
// GetServicesAnalyticsService), как и в легаси buildServiceMap.
//
// Инвариант дедупликации заказов (сохранён буквально): totalRevenue/
// totalProfit/avgOrderCheck считаются по УНИКАЛЬНЫМ orderId, а не по
// строкам услуг — одна услуга может встретиться в заказе несколько раз (или
// один заказ содержит несколько строк этой услуги в разном количестве), но
// payed/cost заказа не должны просуммироваться дважды. totalCount/
// totalEngineerBonus/avgServicePrice, наоборот, считаются по всем строкам
// (quantity суммируется как есть) — эти две оси намеренно расходятся, как и
// в легаси.
export function calculateServiceMetrics(
    rows: readonly ServiceSaleEntity[],
): ServiceMetrics {
    const totalCount = rows.reduce(
        (sum, row) => sum + row.getProps().quantity,
        0,
    );
    const totalEngineerBonus = rows.reduce(
        (sum, row) => sum + row.getProps().engineerSalary,
        0,
    );
    const priceWeightedSum = rows.reduce((sum, row) => {
        const { price, quantity } = row.getProps();
        return sum + price * quantity;
    }, 0);
    const avgServicePrice =
        totalCount > 0 ? Math.round(priceWeightedSum / totalCount) : 0;

    const uniqueOrders = new Map<number, { payed: number; cost: number }>();
    for (const row of rows) {
        const { orderId, orderPayed, orderCost } = row.getProps();
        if (!uniqueOrders.has(orderId)) {
            uniqueOrders.set(orderId, { payed: orderPayed, cost: orderCost });
        }
    }
    const orderValues = [...uniqueOrders.values()];
    const totalRevenue = orderValues.reduce((sum, o) => sum + o.payed, 0);
    const totalProfit = orderValues.reduce(
        (sum, o) => sum + o.payed - o.cost,
        0,
    );
    const avgOrderCheck =
        orderValues.length > 0
            ? Math.round(totalRevenue / orderValues.length)
            : 0;

    return ServiceMetrics.create({
        totalCount,
        totalRevenue,
        totalProfit,
        totalEngineerBonus,
        avgServicePrice,
        avgOrderCheck,
    });
}
