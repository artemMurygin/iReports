import { RewardType } from '../../../prisma/generated/prisma/schema/client';
import { progressionCoef, ProgressionTier } from './progression-coef';

export type RewardConfig = {
  type: RewardType;
  value: number; // PERCENT: сотые процента (1000 = 10%); FIX: сумма в рублях
  minAmount: number | null;
  maxAmount: number | null;
};

function clamp(amount: number, min: number | null, max: number | null): number {
  let result = amount;
  if (min != null) result = Math.max(result, min);
  if (max != null) result = Math.min(result, max);
  return result;
}

// ARCHITECTURE.md §3.2 (в): rawReward = PERCENT ? base×value/10000 : value;
// accrual = clamp(rawReward × progressionCoef(pct), min, max). Деньги — целые рубли.
export function calcAccrual(
  reward: RewardConfig,
  tiers: ProgressionTier[],
  pct: number,
  baseValue: number,
): number {
  const rawReward =
    reward.type === RewardType.PERCENT
      ? baseValue * (reward.value / 10000)
      : reward.value;
  const coef = progressionCoef(pct, tiers);
  return Math.round(
    clamp(rawReward * coef, reward.minAmount, reward.maxAmount),
  );
}
