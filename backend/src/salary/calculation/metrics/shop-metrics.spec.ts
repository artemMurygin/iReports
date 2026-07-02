import { calcShopPositionMetric } from './shop-metrics';
import { KpiStat } from '../../../../prisma/generated/prisma/schema/client';

// Фикстура на позицию moy_sklad_demand_positions: sum=5000, cost=2000, profit=3000, quantity=4.
const row = { sum: 5000, cost: 2000, profit: 3000, quantity: 4 };

describe('calcShopPositionMetric', () => {
  it('REVENUE = sum', () => {
    expect(calcShopPositionMetric(KpiStat.REVENUE, row)).toBe(5000);
  });

  it('COSTS = cost', () => {
    expect(calcShopPositionMetric(KpiStat.COSTS, row)).toBe(2000);
  });

  it('MARGIN = profit (готовое поле)', () => {
    expect(calcShopPositionMetric(KpiStat.MARGIN, row)).toBe(3000);
  });

  it('PCS = quantity', () => {
    expect(calcShopPositionMetric(KpiStat.PCS, row)).toBe(4);
  });

  it('MARGIN_MINUS_ENGINEER неприменим к SHOP и выбрасывает ошибку', () => {
    expect(() =>
      calcShopPositionMetric(KpiStat.MARGIN_MINUS_ENGINEER, row),
    ).toThrow();
  });
});
