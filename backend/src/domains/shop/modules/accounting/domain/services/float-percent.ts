import type { PercentBorder } from '../types/shop-salary-rule.types';
import { roundRubles } from './money';

// Множитель FloatPercent по проценту выполнения плана — Фаза 12 (issue
// #60: "независимая реализация в домене shop, а не переиспользованный код
// сервиса"). Алгоритм идентичен
// domains/service/modules/accounting/domain/services/float-percent.ts
// (resolveFloatPercentMultiplier) — это чистая математика (интерполяция по
// трём точкам), совпадение реализаций естественно для одного и того же
// контракта percentBorders (contracts/commands/salary-rule.ts,
// переиспользуется shop-salary-rule.ts), но код физически не импортируется
// между доменами, как и требует issue #57/#60: два независимых модуля,
// каждый может измениться без последствий для другого.
//
// Три порога percentBorders, каждый — { fromPlanPercent, multiplier, mode }.
// mode лежит НА КАЖДОМ пороге и описывает участок ОТ ЭТОГО порога ВПЕРЁД, до
// СЛЕДУЮЩЕГО порога (или до бесконечности, если порог последний по
// возрастанию fromPlanPercent) — зеркало исправленной семантики
// domains/service/modules/accounting/domain/services/float-percent.ts (см.
// комментарий там же для истории решения):
//
// - FIX    — множитель ступенькой: от fromPlanPercent этого порога и до
//            следующего действует множитель ЭТОГО порога;
// - LINEAR — на отрезке [fromPlanPercent этого порога, fromPlanPercent
//            следующего) множитель линейно интерполируется между
//            множителем этого порога и множителем следующего.
//
// У последнего порога mode не имеет значения — множитель фиксируется на его
// собственном значении. Ниже самого нижнего порога — множитель 0.
export function resolveFloatPercentMultiplier(
    percentBorders: readonly [PercentBorder, PercentBorder, PercentBorder],
    percentCompletion: number,
): number {
    const sorted = [...percentBorders].sort(
        (a, b) => a.fromPlanPercent - b.fromPlanPercent,
    );

    let currentIndex = -1;
    for (let i = 0; i < sorted.length; i++) {
        if (percentCompletion >= sorted[i].fromPlanPercent) {
            currentIndex = i;
        }
    }
    if (currentIndex === -1) {
        return 0;
    }

    const current = sorted[currentIndex];
    const next = sorted[currentIndex + 1];
    if (current.mode === 'FIX' || !next) {
        return current.multiplier;
    }

    const span = next.fromPlanPercent - current.fromPlanPercent;
    if (span <= 0) {
        return current.multiplier;
    }
    const ratio = (percentCompletion - current.fromPlanPercent) / span;
    return current.multiplier + ratio * (next.multiplier - current.multiplier);
}

export interface FloatPercentThresholdInfo {
    currentThreshold: PercentBorder | null;
    nextThreshold: PercentBorder | null;
    diffToNext: number | null;
}

// Текущий/следующий порог для отчёта (Фаза 13.5, зеркало
// resolveFloatPercentThresholds сервиса — независимая реализация, issue
// #57). currentThreshold — null, если percentCompletion ниже самого нижнего
// порога; nextThreshold — null, если порогов выше нет.
export function resolveFloatPercentThresholds(
    percentBorders: readonly [PercentBorder, PercentBorder, PercentBorder],
    percentCompletion: number,
): Pick<FloatPercentThresholdInfo, 'currentThreshold' | 'nextThreshold'> {
    const sorted = [...percentBorders].sort(
        (a, b) => a.fromPlanPercent - b.fromPlanPercent,
    );

    let current: PercentBorder | null = null;
    let next: PercentBorder | null = null;
    for (const border of sorted) {
        if (percentCompletion >= border.fromPlanPercent) {
            current = border;
        } else if (next === null) {
            next = border;
        }
    }
    return { currentThreshold: current, nextThreshold: next };
}

// diffToNext — в обороте, не в процентных пунктах (зеркало
// buildFloatPercentThresholdInfo сервиса), считается от фактического/
// прогнозного оборота напрямую, а не обратным пересчётом от округлённого
// percentCompletion.
export function buildFloatPercentThresholdInfo(
    percentBorders: readonly [PercentBorder, PercentBorder, PercentBorder],
    percentCompletion: number,
    planTurnover: number,
    actualTurnover: number,
): FloatPercentThresholdInfo {
    const { currentThreshold, nextThreshold } = resolveFloatPercentThresholds(
        percentBorders,
        percentCompletion,
    );
    const diffToNext = nextThreshold
        ? Math.max(
              0,
              roundRubles(
                  (planTurnover * nextThreshold.fromPlanPercent) / 100 -
                      actualTurnover,
              ),
          )
        : null;
    return { currentThreshold, nextThreshold, diffToNext };
}
