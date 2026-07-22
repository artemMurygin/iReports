import { calcServiceOrderMetric } from './service-metrics';
import { KpiStat } from '../../../../prisma/generated/prisma/schema/client';

// Фикстура на позицию roapp_service_orders: price=1000, quantity=2, discount=100,
// cost=300, engeneerSalary=150.
const row = {
  price: 1000,
  quantity: 2,
  discount: 100,
  cost: 300,
  engeneerSalary: 150,
};

describe('calcServiceOrderMetric', () => {
  it('REVENUE = price*quantity - discount', () => {
    expect(calcServiceOrderMetric(KpiStat.REVENUE, row)).toBe(1900);
  });

  it('COSTS = cost*quantity', () => {
    expect(calcServiceOrderMetric(KpiStat.COSTS, row)).toBe(600);
  });

  it('MARGIN = REVENUE - COSTS', () => {
    expect(calcServiceOrderMetric(KpiStat.MARGIN, row)).toBe(1300);
  });

  it('MARGIN_MINUS_ENGINEER = MARGIN - engeneerSalary', () => {
    expect(calcServiceOrderMetric(KpiStat.MARGIN_MINUS_ENGINEER, row)).toBe(
      1150,
    );
  });

  it('PCS = quantity', () => {
    expect(calcServiceOrderMetric(KpiStat.PCS, row)).toBe(2);
  });
});
