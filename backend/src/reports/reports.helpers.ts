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

  const revenue = deals.reduce((s, d) => {
    if (d.stage?.id === 'WON') return (s += d.opportunity ?? 0);
    return s;
  }, 0);

  const allLeads = deals.length;
  const nonTargetDeals = deals.filter((d) => d.stage?.id === '3').length;
  const targetedLeads = deals.filter((d) => d.stage?.id !== '3').length;
  const won = deals.filter((d) => d.stage?.id === 'WON').length;
  const lose = deals.filter((d) => loseStages.includes(d.stage?.id)).length;
  const inWork = deals.filter((d) => inWorkStages.includes(d.stage?.id)).length;
  const waitingInService = deals.filter((d) =>
    waitingInServiceStages.includes(d.stage?.id),
  ).length;
  const inService = deals.filter((d) =>
    inServiceStages.includes(d.stage?.id),
  ).length;
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
