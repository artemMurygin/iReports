import { ServiceSaleEntity } from '../entities/service-sale.entity';
import { ServiceMetrics } from '../value-objects/service-metrics.value-object';

// Перенос calcServiceMetrics (src/TODO/reports/reports.service.ts). rows —
// все строки "услуга × заказ" ОДНОЙ услуги за период (вызывающий код
// группирует по serviceId, см. GetServicesAnalyticsService), как и в легаси
// buildServiceMap.
export function calculateServiceMetrics(
    rows: readonly ServiceSaleEntity[],
): ServiceMetrics {
    // spec: service/reports#requirement-показатели-количества-и-бонуса-считаются-по-всем-строкам-услуги
    const totalCount = rows.reduce(
        (sum, row) => sum + row.getProps().quantity,
        0,
    );
    const totalEngineerBonus = rows.reduce(
        (sum, row) => sum + row.getProps().engineerSalary,
        0,
    );
    // spec: service/reports#requirement-средняя-цена-услуги-средневзвешенная-по-количеству
    const priceWeightedSum = rows.reduce((sum, row) => {
        const { price, quantity } = row.getProps();
        return sum + price * quantity;
    }, 0);
    const avgServicePrice =
        totalCount > 0 ? Math.round(priceWeightedSum / totalCount) : 0;

    // spec: service/reports#requirement-выручка-прибыль-и-средний-чек-считаются-по-уникальным-заказам-а-не-по-строкам
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
