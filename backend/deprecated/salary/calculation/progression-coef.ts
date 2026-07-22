import { ProgressionMode } from '../../../prisma/generated/prisma/schema/client';

// Кусочная функция «% выполнения плана → коэффициент к базовому %» (RewardProgressionTier).
export type ProgressionTier = {
  fromPct: number; // включительно
  toPct: number | null; // не включительно; null = +бесконечность
  mode: ProgressionMode;
  coef: number | null; // FIXED / MULTIPLIER
  coefFrom: number | null; // LINEAR
  coefTo: number | null; // LINEAR
};

// Нет подходящего тира (дыра в конфигурации правила) → коэффициент 1 (без изменений).
export function progressionCoef(pct: number, tiers: ProgressionTier[]): number {
  const tier = tiers.find(
    (t) => pct >= t.fromPct && (t.toPct == null || pct < t.toPct),
  );
  if (!tier) return 1;

  switch (tier.mode) {
    case ProgressionMode.FIXED:
    case ProgressionMode.MULTIPLIER:
      return tier.coef!;
    case ProgressionMode.LINEAR: {
      const span = tier.toPct! - tier.fromPct;
      const k = span === 0 ? 0 : (pct - tier.fromPct) / span;
      return tier.coefFrom! + (tier.coefTo! - tier.coefFrom!) * k;
    }
  }
}
