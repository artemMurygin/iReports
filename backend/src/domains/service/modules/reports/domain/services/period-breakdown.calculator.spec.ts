import { ServiceSaleEntity } from '../entities/service-sale.entity';
import { PeriodBucket } from '../value-objects/period-bucket.value-object';
import { buildPeriodBreakdown } from './period-breakdown.calculator';

function buildRow(
    closedAt: string,
    quantity: number,
    price: number,
): ServiceSaleEntity {
    return new ServiceSaleEntity({
        id: `${closedAt}-${quantity}-${price}`,
        props: {
            serviceId: 1,
            serviceName: 'Замена экрана',
            categoryId: 10,
            orderId: 1,
            quantity,
            price,
            engineerSalary: 0,
            closedAt: new Date(closedAt),
            orderPayed: 0,
            orderCost: 0,
        },
    });
}

// Паритет с buildPeriodBreakdown (src/TODO/reports/reports.service.ts,
// удалён этой же фазой) — фиксирует ожидаемые значения напрямую.
describe('buildPeriodBreakdown', () => {
    it('периоды без единой продажи отдаются с count/avgPrice = 0', () => {
        const bucket = PeriodBucket.create('day');
        const periods = bucket.generateKeys(
            new Date('2026-01-01T00:00:00.000Z'),
            new Date('2026-01-03T00:00:00.000Z'),
        );

        const breakdown = buildPeriodBreakdown([], periods, bucket);

        expect(breakdown).toEqual([
            { period: '2026-01-01', count: 0, avgPrice: 0 },
            { period: '2026-01-02', count: 0, avgPrice: 0 },
            { period: '2026-01-03', count: 0, avgPrice: 0 },
        ]);
    });

    it('count суммирует quantity в бакете, avgPrice — средневзвешенная по quantity цена', () => {
        const bucket = PeriodBucket.create('day');
        const periods = bucket.generateKeys(
            new Date('2026-01-01T00:00:00.000Z'),
            new Date('2026-01-02T00:00:00.000Z'),
        );
        const rows = [
            buildRow('2026-01-01T10:00:00.000Z', 2, 1000),
            buildRow('2026-01-01T15:00:00.000Z', 1, 4000),
            buildRow('2026-01-02T08:00:00.000Z', 3, 500),
        ];

        const breakdown = buildPeriodBreakdown(rows, periods, bucket);

        // 2026-01-01: count = 2+1 = 3, avgPrice = round((1000*2 + 4000*1) / 3) = 2000
        expect(breakdown[0]).toEqual({
            period: '2026-01-01',
            count: 3,
            avgPrice: 2000,
        });
        // 2026-01-02: count = 3, avgPrice = 500
        expect(breakdown[1]).toEqual({
            period: '2026-01-02',
            count: 3,
            avgPrice: 500,
        });
    });

    it('строка вне списка periods не ломает расчёт (просто не попадает в ответ)', () => {
        const bucket = PeriodBucket.create('day');
        const periods = bucket.generateKeys(
            new Date('2026-01-01T00:00:00.000Z'),
            new Date('2026-01-01T00:00:00.000Z'),
        );
        const rows = [buildRow('2026-06-01T00:00:00.000Z', 5, 100)];

        const breakdown = buildPeriodBreakdown(rows, periods, bucket);

        expect(breakdown).toEqual([
            { period: '2026-01-01', count: 0, avgPrice: 0 },
        ]);
    });
});
