import { ServiceSaleEntity } from '../entities/service-sale.entity';
import { calculateServiceMetrics } from './service-metrics.calculator';

// Паритет с calcServiceMetrics (src/TODO/reports/reports.service.ts, удалён
// этой же фазой) — фиксирует ожидаемые числа напрямую (та же стратегия, что
// у period-bucket.value-object.spec.ts), а не сравнением с уже удалённой
// легаси-функцией.
function buildRow(overrides: {
    id: string;
    orderId: number;
    quantity: number;
    price: number;
    engineerSalary: number;
    orderPayed: number;
    orderCost: number;
}): ServiceSaleEntity {
    return new ServiceSaleEntity({
        id: overrides.id,
        props: {
            serviceId: 1,
            serviceName: 'Замена экрана',
            categoryId: 10,
            orderId: overrides.orderId,
            quantity: overrides.quantity,
            price: overrides.price,
            engineerSalary: overrides.engineerSalary,
            closedAt: new Date('2026-01-15T00:00:00.000Z'),
            orderPayed: overrides.orderPayed,
            orderCost: overrides.orderCost,
        },
    });
}

describe('calculateServiceMetrics', () => {
    it('пустой список строк даёт нулевые метрики без деления на 0', () => {
        const metrics = calculateServiceMetrics([]);

        expect(metrics.getTotalCount()).toBe(0);
        expect(metrics.getTotalRevenue()).toBe(0);
        expect(metrics.getTotalProfit()).toBe(0);
        expect(metrics.getTotalEngineerBonus()).toBe(0);
        expect(metrics.getAvgServicePrice()).toBe(0);
        expect(metrics.getAvgOrderCheck()).toBe(0);
    });

    it('totalCount/totalEngineerBonus/avgServicePrice считаются по всем строкам услуги', () => {
        const rows = [
            buildRow({
                id: '1',
                orderId: 100,
                quantity: 2,
                price: 1000,
                engineerSalary: 300,
                orderPayed: 5000,
                orderCost: 2000,
            }),
            buildRow({
                id: '2',
                orderId: 101,
                quantity: 1,
                price: 2000,
                engineerSalary: 500,
                orderPayed: 3000,
                orderCost: 1000,
            }),
        ];

        const metrics = calculateServiceMetrics(rows);

        expect(metrics.getTotalCount()).toBe(3);
        expect(metrics.getTotalEngineerBonus()).toBe(800);
        // avgServicePrice — средневзвешенная по quantity: (1000*2 + 2000*1) / 3 = 1333.33 → 1333
        expect(metrics.getAvgServicePrice()).toBe(1333);
    });

    it('totalRevenue/totalProfit/avgOrderCheck считаются по уникальным заказам, а не по строкам услуг', () => {
        // Два ряда одной и той же услуги в ОДНОМ заказе (orderId: 100) — payed/cost
        // заказа не должны просуммироваться дважды.
        const rows = [
            buildRow({
                id: '1',
                orderId: 100,
                quantity: 1,
                price: 1000,
                engineerSalary: 100,
                orderPayed: 5000,
                orderCost: 2000,
            }),
            buildRow({
                id: '2',
                orderId: 100,
                quantity: 1,
                price: 1200,
                engineerSalary: 150,
                orderPayed: 5000,
                orderCost: 2000,
            }),
            buildRow({
                id: '3',
                orderId: 101,
                quantity: 1,
                price: 900,
                engineerSalary: 90,
                orderPayed: 3000,
                orderCost: 1500,
            }),
        ];

        const metrics = calculateServiceMetrics(rows);

        // 2 уникальных заказа: (5000, 2000) и (3000, 1500)
        expect(metrics.getTotalRevenue()).toBe(8000);
        expect(metrics.getTotalProfit()).toBe(4500);
        expect(metrics.getAvgOrderCheck()).toBe(4000);
        // totalCount при этом считает все 3 строки услуги, не 2 заказа
        expect(metrics.getTotalCount()).toBe(3);
    });

    it('для повторного orderId берётся payed/cost из ПЕРВОЙ встреченной строки', () => {
        const rows = [
            buildRow({
                id: '1',
                orderId: 100,
                quantity: 1,
                price: 1000,
                engineerSalary: 0,
                orderPayed: 5000,
                orderCost: 2000,
            }),
            // Та же order с другими (некорректными для теста) payed/cost —
            // не должна повлиять на результат, дедупликация берёт первую.
            buildRow({
                id: '2',
                orderId: 100,
                quantity: 1,
                price: 1000,
                engineerSalary: 0,
                orderPayed: 999_999,
                orderCost: 999_999,
            }),
        ];

        const metrics = calculateServiceMetrics(rows);

        expect(metrics.getTotalRevenue()).toBe(5000);
        expect(metrics.getTotalProfit()).toBe(3000);
    });
});
