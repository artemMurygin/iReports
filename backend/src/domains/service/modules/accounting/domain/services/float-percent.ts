import type { PercentBorder } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Множитель FloatPercent по проценту выполнения плана (Фаза 8, см.
// docs/payroll/plan-payroll-calculation.md и prd-payroll-calculation.md,
// раздел 2). Три порога percentBorders, каждый — { fromPlanPercent,
// multiplier, mode }; mode лежит НА КАЖДОМ пороге (так задан контракт PRD:
// "каждый — { fromPlanPercent, multiplier, mode: FIX | LINEAR }"), а не
// одним полем на всё правило — mode описывает, как считается участок между
// ПРЕДЫДУЩИМ порогом (или нулевой точкой [0, 0], если порог первый по
// возрастанию fromPlanPercent) и этим порогом:
//
// - FIX   — множитель ступенькой: пока percentCompletion не достиг
//           fromPlanPercent этого порога, действует множитель предыдущего
//           порога (0, если порог первый);
// - LINEAR — на этом участке множитель линейно интерполируется между
//           множителем предыдущего порога и множителем этого порога.
//
// После последнего (по fromPlanPercent) порога множитель не растёт дальше —
// зафиксирован на его значении (сотрудник, перевыполнивший план сверх
// старшего порога, получает множитель этого порога, а не экстраполяцию
// вверх). Ниже самого нижнего порога, если у него FIX — множитель 0; если
// LINEAR — линейная интерполяция от условной точки (0, 0).
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

    // percentCompletion достиг или превысил все пороги — множитель
    // фиксируется на значении старшего порога.
    return prev.multiplier;
}
