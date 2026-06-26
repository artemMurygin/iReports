import { BitrixDealGetPayload } from '../../prisma/generated/prisma/schema/models/BitrixDeal';

type DealWithRelations = BitrixDealGetPayload<{
  include: {
    stage: true;
    assignedBy: true;
    source: true;
    leadSource: true;
    brand: true;
    deviceType: true;
  };
}>;

export function serviceFunnelKPICalculation(deals: any) {
  const inWorkStages = [
    'UC_U52J7C',
    'UC_HML04K',
    'UC_E2KAHD',
    'NEW',
    'UC_ZR6PTH',
    'UC_X5VJM9',
    'UC_7FXM5Z',
    'UC_CDLDG7',
    'UC_2SD91N',
  ];
  const waitingInServiceStages = ['EXECUTING'];
  const inServiceStages = ['UC_UPDA02', 'UC_EWM3W9'];
  const loseStages = [
    '4',
    '8',
    '7',
    '6',
    '5',
    '1',
    'LOSE',
    '2',
    '12',
    'UC_6NHK6F',
    '13',
  ];

  const counts = deals.reduce(
    (acc, d) => {
      const stageId = d.stage?.id;
      if (stageId === '3') acc.nonTargetDeals++;
      else acc.targetedLeads++;
      if (stageId === 'WON') {
        acc.won++;
        acc.revenue += d.opportunity ?? 0;
      }
      if (loseStages.includes(stageId)) acc.lose++;
      if (inWorkStages.includes(stageId)) acc.inWork++;
      if (waitingInServiceStages.includes(stageId)) acc.waitingInService++;
      if (inServiceStages.includes(stageId)) acc.inService++;
      return acc;
    },
    {
      nonTargetDeals: 0,
      targetedLeads: 0,
      won: 0,
      lose: 0,
      inWork: 0,
      waitingInService: 0,
      inService: 0,
      revenue: 0,
    },
  );

  const allLeads = deals.length;
  const {
    nonTargetDeals,
    targetedLeads,
    won,
    lose,
    inWork,
    waitingInService,
    inService,
    revenue,
  } = counts;
  const conversionRate =
    targetedLeads > 0 ? Math.round((won / targetedLeads) * 1000) / 10 : 0;
  const avgDeal = won > 0 ? Math.round(revenue / won) : 0;

  return {
    allLeads,
    nonTargetDeals,
    targetedLeads,
    won,
    lose,
    inWork,
    waitingInService,
    inService,
    conversionRate,
    avgDeal,
    revenue,
  };
}

export function inFilter<T extends string | number>(val: T[]) {
  return val.length > 0 ? { in: val } : undefined;
}

export function uniqueBy<T>(arr: T[], key: keyof T): T[] {
  return [...new Map(arr.map((item) => [item[key], item])).values()];
}

export type SoldServiceRow = {
  closedAt: Date;
  orderId: number;
  quantity: number;
  orderPayed: number;
  orderCost: number;
};

export type PeriodGroupBy = 'day' | 'week' | 'month';

function getPeriodBucketStart(date: Date, groupBy: PeriodGroupBy): Date {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  if (groupBy === 'month') {
    d.setUTCDate(1);
  } else if (groupBy === 'week') {
    const day = d.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diffToMonday);
  }

  return d;
}

function getPeriodBucketKey(date: Date, groupBy: PeriodGroupBy): string {
  return getPeriodBucketStart(date, groupBy).toISOString().slice(0, 10);
}

function incrementPeriod(date: Date, groupBy: PeriodGroupBy): Date {
  const next = new Date(date);
  if (groupBy === 'day') next.setUTCDate(next.getUTCDate() + 1);
  else if (groupBy === 'week') next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function generatePeriodKeys(
  momentFrom: Date,
  momentTo: Date,
  groupBy: PeriodGroupBy,
): string[] {
  const keys: string[] = [];
  const end = getPeriodBucketStart(momentTo, groupBy);
  let cursor = getPeriodBucketStart(momentFrom, groupBy);

  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor = incrementPeriod(cursor, groupBy);
  }

  return keys;
}

export function groupSoldServicesByPeriod(
  rows: SoldServiceRow[],
  groupBy: PeriodGroupBy,
  momentFrom: Date,
  momentTo: Date,
) {
  const buckets = new Map<
    string,
    { count: number; orders: Map<number, { payed: number; cost: number }> }
  >();

  for (const row of rows) {
    const key = getPeriodBucketKey(row.closedAt, groupBy);
    const bucket = buckets.get(key) ?? { count: 0, orders: new Map() };
    bucket.count += row.quantity;
    if (!bucket.orders.has(row.orderId)) {
      bucket.orders.set(row.orderId, {
        payed: row.orderPayed,
        cost: row.orderCost,
      });
    }
    buckets.set(key, bucket);
  }

  return generatePeriodKeys(momentFrom, momentTo, groupBy).map((period) => {
    const bucket = buckets.get(period);
    if (!bucket) {
      return {
        period,
        ordersCount: 0,
        count: 0,
        revenue: 0,
        profit: 0,
        averageCheck: 0,
      };
    }

    const { count, orders } = bucket;
    const orderValues = [...orders.values()];
    const revenue = orderValues.reduce((sum, o) => sum + o.payed, 0);
    const profit = orderValues.reduce((sum, o) => sum + o.payed - o.cost, 0);
    const ordersCount = orders.size;

    return {
      period,
      ordersCount,
      count,
      revenue,
      profit,
      averageCheck: ordersCount > 0 ? Math.round(revenue / ordersCount) : 0,
    };
  });
}
