import type { PercentBorder } from '../types/shop-salary-rule.types';

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
// mode лежит НА КАЖДОМ пороге и описывает участок МЕЖДУ предыдущим порогом
// (или нулевой точкой, если порог первый по возрастанию fromPlanPercent) и
// этим порогом:
//
// - FIX    — множитель ступенькой: пока percentCompletion не достиг
//            fromPlanPercent этого порога, действует множитель предыдущего
//            порога (0, если порог первый);
// - LINEAR — на этом участке множитель линейно интерполируется между
//            множителем предыдущего порога и множителем этого порога.
//
// После последнего (по fromPlanPercent) порога множитель фиксируется на
// его значении — не растёт дальше при перевыполнении плана сверх старшего
// порога.
export function resolveFloatPercentMultiplier(
    percentBorders: readonly [PercentBorder, PercentBorder, PercentBorder],
    percentCompletion: number,
): number {
    const sorted = [...percentBorders].sort(
        (a, b) => a.fromPlanPercent - b.fromPlanPercent,
    );

    let prev = { fromPlanPercent: 0, multiplier: 0 };
    for (const border of sorted) {
        if (percentCompletion < border.fromPlanPercent) {
            if (border.mode === 'FIX') {
                return prev.multiplier;
            }
            const span = border.fromPlanPercent - prev.fromPlanPercent;
            if (span <= 0) {
                return border.multiplier;
            }
            const ratio = (percentCompletion - prev.fromPlanPercent) / span;
            return (
                prev.multiplier + ratio * (border.multiplier - prev.multiplier)
            );
        }
        prev = border;
    }

    return prev.multiplier;
}
