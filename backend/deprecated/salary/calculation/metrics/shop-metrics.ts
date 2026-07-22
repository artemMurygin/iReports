import { KpiStat } from '../../../../prisma/generated/prisma/schema/client';

// Маппинг KpiStat -> поля moy_sklad_demand_positions, см. ARCHITECTURE.md §4.2.
// Атрибуция факта — по online_manager_id/offline_manager_id, период — moy_sklad_demands.moment.
export type ShopPositionMetricInput = {
  sum: number;
  cost: number;
  profit: number;
  quantity: number;
};

export function calcShopPositionMetric(
  stat: KpiStat,
  row: ShopPositionMetricInput,
): number {
  switch (stat) {
    case KpiStat.REVENUE:
      return row.sum;
    case KpiStat.COSTS:
      return row.cost;
    case KpiStat.MARGIN:
      return row.profit;
    case KpiStat.PCS:
      return row.quantity;
    case KpiStat.MARGIN_MINUS_ENGINEER:
      // Неприменимо к направлению SHOP — должно быть отсечено валидацией при сохранении правила.
      throw new Error(
        'KpiStat.MARGIN_MINUS_ENGINEER неприменим к направлению SHOP',
      );
  }
}
