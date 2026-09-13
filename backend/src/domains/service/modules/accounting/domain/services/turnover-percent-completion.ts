// implements FR4 of add-department-head-salary-rules
// architecture.md "resolveTurnoverPercentCompletion" — процент выполнения плана коэффициента
// оборачиваемости, вход resolveFloatPercentMultiplier у DepartmentTurnoverBonusEntity (design.md
// Decision 2: "amount = round(fixedAmount * resolveFloatPercentMultiplier(percentBorders,
// (factTurnoverRatio / planTurnoverRatio) * 100))"). planRatio — TurnoverRatioValueObject.value из
// конфига самого правила, всегда > 0 (собственный инвариант VO) — деление на 0 здесь не
// защищается отдельно.
//
// factRatio = null — недостаточно данных (TurnoverPerformanceReaderPort.findForScope не нашёл ни
// снапшота, ни рассчитанного коэффициента у категории/итога склада) — результат тоже null, а не 0:
// правило ещё не может посчитать множитель, а не должно посчитать его нулевым.
export function resolveTurnoverPercentCompletion(
    factRatio: number | null,
    planRatio: number,
): number | null {
    if (factRatio === null) {
        return null;
    }

    return (factRatio / planRatio) * 100;
}
