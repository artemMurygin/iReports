import { progressionCoef, ProgressionTier } from './progression-coef';
import { ProgressionMode } from '../../../prisma/generated/prisma/schema/client';

// Пример прогрессии из ARCHITECTURE.md §2.5:
// 0–70 → ×0.5 (FIXED), 70–120 → линейно 0.5→1.0, >120 → ×1.2 (MULTIPLIER)
const tiers: ProgressionTier[] = [
  {
    fromPct: 0,
    toPct: 70,
    mode: ProgressionMode.FIXED,
    coef: 0.5,
    coefFrom: null,
    coefTo: null,
  },
  {
    fromPct: 70,
    toPct: 120,
    mode: ProgressionMode.LINEAR,
    coef: null,
    coefFrom: 0.5,
    coefTo: 1.0,
  },
  {
    fromPct: 120,
    toPct: null,
    mode: ProgressionMode.MULTIPLIER,
    coef: 1.2,
    coefFrom: null,
    coefTo: null,
  },
];

describe('progressionCoef', () => {
  it('FIXED: возвращает постоянный коэффициент внутри тира', () => {
    expect(progressionCoef(35, tiers)).toBe(0.5);
  });

  it('FIXED: включает нижнюю границу диапазона (0%)', () => {
    expect(progressionCoef(0, tiers)).toBe(0.5);
  });

  it('LINEAR: на границе 70% попадает во второй тир (fromPct включительно)', () => {
    expect(progressionCoef(70, tiers)).toBeCloseTo(0.5);
  });

  it('LINEAR: интерполирует внутри диапазона (95% → середина 70–120)', () => {
    expect(progressionCoef(95, tiers)).toBeCloseTo(0.75);
  });

  it('LINEAR: toPct не включается в тот же тир — 120% уже относится к следующему', () => {
    expect(progressionCoef(120, tiers)).toBeCloseTo(1.2);
  });

  it('MULTIPLIER: работает для не ограниченного сверху диапазона (150%)', () => {
    expect(progressionCoef(150, tiers)).toBe(1.2);
  });

  it('без подходящего тира возвращает 1 (нейтральный коэффициент)', () => {
    expect(progressionCoef(-10, tiers)).toBe(1);
  });

  it('тир с fromPct === toPct не может быть выбран (пустой диапазон) — падает на нейтральный коэффициент', () => {
    const degenerate: ProgressionTier[] = [
      {
        fromPct: 50,
        toPct: 50,
        mode: ProgressionMode.LINEAR,
        coef: null,
        coefFrom: 0.5,
        coefTo: 1.0,
      },
    ];
    expect(progressionCoef(50, degenerate)).toBe(1);
  });
});
