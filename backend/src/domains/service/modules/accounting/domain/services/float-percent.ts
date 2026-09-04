import type { PercentBorder } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { roundRubles } from '@/domains/service/modules/accounting/domain/services/money';

// spec: service/accounting#requirement-множитель-по-проценту-выполнения-плана-ступенчатый-или-линейный
//
// mode лежит НА КАЖДОМ пороге (контракт PRD, docs/payroll/plan-payroll-calculation.md, раздел 2),
// а не одним полем на всё правило, и описывает участок ОТ этого порога ВПЕРЁД, до следующего.
//
// Осторожно при рефакторинге: изначально mode стоял на пороге, задающем ВЕРХНЮЮ границу отрезка,
// и описывал отрезок ДО себя — это давало обратный эффект (LINEAR интерполировал не в ту сторону,
// FIX "замораживал" множитель соседнего порога). Верная семантика — mode на НИЖНЕЙ границе отрезка,
// описывает, что происходит ПОСЛЕ неё.
export function resolveFloatPercentMultiplier(
    percentBorders: readonly [PercentBorder, PercentBorder, PercentBorder],
    percentCompletion: number,
): number {
    const sorted = [...percentBorders].sort(
        (a, b) => a.fromPlanPercent - b.fromPlanPercent,
    );

    // Текущий "активный" порог — последний по возрастанию fromPlanPercent,
    // которого percentCompletion уже достиг.
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
    // В обороте (рублях), не в процентных пунктах — сколько ещё оборота
    // отделу не хватает до следующего порога при неизменном плане (Фаза 9,
    // см. PRD, раздел 6: "чтобы UI мог показать «до следующего порога
    // осталось N по обороту»"). null, если следующего порога нет
    // (percentCompletion уже достиг/превысил старший порог).
    diffToNext: number | null;
}

// Текущий/следующий порог для отчёта (Фаза 9) — отдельно от множителя
// (resolveFloatPercentMultiplier выше), потому что отчёту нужен не только
// численный результат, но и сами пороги для отображения ("до следующего
// осталось..."). currentThreshold — null, если percentCompletion ниже
// самого нижнего порога; nextThreshold — null, если порогов выше нет.
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

// diffToNext считается от фактического/прогнозного оборота напрямую
// (actualTurnover), а не через обратное умножение percentCompletion —
// percentCompletion в SalesFact/SalesPrognose уже округлён до сотых (см.
// percentOf() в sales-fact.value-object.ts), обратный пересчёт от него
// накопил бы лишнюю погрешность.
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
