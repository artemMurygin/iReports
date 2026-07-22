import { KpiStat } from '../../../../prisma/generated/prisma/schema/client';

// Изолирует маппинг KpiStat -> реальные (и опечатанные — "engeneer") поля roapp_service_orders,
// см. ARCHITECTURE.md §4.1. Атрибуция факта — по engineer_id, период — roapp_orders.closed_at.
export type ServiceOrderMetricInput = {
  price: number;
  quantity: number;
  discount: number;
  cost: number;
  engeneerSalary: number;
};

export function calcServiceOrderMetric(
  stat: KpiStat,
  row: ServiceOrderMetricInput,
): number {
  const revenue = row.price * row.quantity - row.discount;
  const costs = row.cost * row.quantity;
  const margin = revenue - costs;

  switch (stat) {
    case KpiStat.REVENUE:
      return revenue;
    case KpiStat.COSTS:
      return costs;
    case KpiStat.MARGIN:
      return margin;
    case KpiStat.MARGIN_MINUS_ENGINEER:
      return margin - row.engeneerSalary;
    case KpiStat.PCS:
      return row.quantity;
  }
}
