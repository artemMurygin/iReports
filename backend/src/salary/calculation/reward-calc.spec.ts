import { calcAccrual, RewardConfig } from './reward-calc';
import {
  ProgressionMode,
  RewardType,
} from '../../../prisma/generated/prisma/schema/client';
import { ProgressionTier } from './progression-coef';

const flatTier: ProgressionTier[] = [
  {
    fromPct: 0,
    toPct: null,
    mode: ProgressionMode.FIXED,
    coef: 1,
    coefFrom: null,
    coefTo: null,
  },
];

describe('calcAccrual', () => {
  it('PERCENT: rawReward = base × value/10000', () => {
    const reward: RewardConfig = {
      type: RewardType.PERCENT,
      value: 1000, // 10%
      minAmount: null,
      maxAmount: null,
    };
    // base=10000 -> raw=1000, coef=1 -> 1000
    expect(calcAccrual(reward, flatTier, 100, 10000)).toBe(1000);
  });

  it('FIX: rawReward = value, база игнорируется', () => {
    const reward: RewardConfig = {
      type: RewardType.FIX,
      value: 5000,
      minAmount: null,
      maxAmount: null,
    };
    expect(calcAccrual(reward, flatTier, 100, 999999)).toBe(5000);
  });

  it('умножает на progressionCoef по проценту выполнения плана', () => {
    const reward: RewardConfig = {
      type: RewardType.PERCENT,
      value: 1000,
      minAmount: null,
      maxAmount: null,
    };
    const tiers: ProgressionTier[] = [
      {
        fromPct: 0,
        toPct: null,
        mode: ProgressionMode.MULTIPLIER,
        coef: 1.2,
        coefFrom: null,
        coefTo: null,
      },
    ];
    // raw=1000, coef=1.2 -> 1200
    expect(calcAccrual(reward, tiers, 150, 10000)).toBe(1200);
  });

  it('обрезает по maxAmount (потолок выплаты)', () => {
    const reward: RewardConfig = {
      type: RewardType.PERCENT,
      value: 1000,
      minAmount: null,
      maxAmount: 500,
    };
    expect(calcAccrual(reward, flatTier, 100, 10000)).toBe(500);
  });

  it('поднимает до minAmount (гарантированный минимум)', () => {
    const reward: RewardConfig = {
      type: RewardType.PERCENT,
      value: 1000,
      minAmount: 2000,
      maxAmount: null,
    };
    expect(calcAccrual(reward, flatTier, 100, 10000)).toBe(2000);
  });

  it('корректно обрабатывает отрицательную базу (убыточный заказ)', () => {
    const reward: RewardConfig = {
      type: RewardType.PERCENT,
      value: 1000,
      minAmount: null,
      maxAmount: null,
    };
    expect(calcAccrual(reward, flatTier, 100, -10000)).toBe(-1000);
  });

  it('округляет до целого рубля', () => {
    const reward: RewardConfig = {
      type: RewardType.PERCENT,
      value: 333, // 3.33%
      minAmount: null,
      maxAmount: null,
    };
    // raw = 10000*0.0333 = 333 -> целое уже, проверим дробный случай
    expect(calcAccrual(reward, flatTier, 100, 1001)).toBe(
      Math.round(1001 * 0.0333),
    );
  });
});
