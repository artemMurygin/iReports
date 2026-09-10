// implements FR4 of add-department-head-salary-rules
// Зеркало domains/service/modules/accounting/domain/services/turnover-percent-completion.ts для
// shop (design.md Decision 5 — независимая реализация по домену, без общего кода) —
// architecture.md "resolveTurnoverPercentCompletion": процент выполнения плана коэффициента
// оборачиваемости, вход FloatPercentSchedule у DepartmentTurnoverBonusEntity (shop). planRatio —
// значение конфига самого правила, всегда > 0 — деление на 0 здесь не защищается отдельно.
//
// factRatio = null — недостаточно данных (SHOP_TURNOVER_PERFORMANCE_READER не нашёл ни снапшота,
// ни рассчитанного коэффициента у категории/итога склада) — результат тоже null, а не 0.
export function resolveTurnoverPercentCompletion(
    factRatio: number | null,
    planRatio: number,
): number | null {
    if (factRatio === null) {
        return null;
    }

    return (factRatio / planRatio) * 100;
}
