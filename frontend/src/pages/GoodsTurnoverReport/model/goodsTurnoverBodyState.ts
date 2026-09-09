import type { GoodsTurnoverReportLineResponse } from 'ireports-contracts'

// Выбор состояния тела отчёта (openspec/changes/service-turnover-report, задача 19;
// ui-design.md "Ключевые состояния"). Загрузка (`isInitialLoad`) сюда не входит — она
// перехватывается раньше, на уровне `Layout`/`RefreshTransitionLayout` (задача 19.1: "чисто
// визуальная задача без ветвлений" — `SpinnerPageLg` вместо `body`, этот резолвер вообще не
// вызывается, пока идёт первая загрузка), поэтому здесь только 3 состояния: ошибка запроса,
// период ещё ни разу не пересчитан (пустой список строк — валидный ответ, не ошибка, design.md
// D5/ui-design.md "отчёт ещё не пересчитывался"), и обычный заполненный отчёт.
export type GoodsTurnoverBodyState = 'error' | 'not-recalculated' | 'ready'

export type ResolveGoodsTurnoverBodyStateInput = {
    error: string | null
    lines: GoodsTurnoverReportLineResponse[] | undefined
}

/**
 * Чистая функция выбора состояния — вынесена из презентационного компонента
 * (`ui/GoodsTurnoverReportBody.tsx`) отдельно, чтобы её можно было протестировать без рендера
 * React-дерева (задача 19.5/19.6, TDD на выбор состояния).
 *
 * Приоритет: ошибка запроса перекрывает пустой список строк (`lines` в этом случае обычно тоже
 * `undefined` — `useQuery` не вернул данные), иначе пустой/ещё не загруженный список — состояние
 * «не пересчитан», иначе — обычный рендер таблицы.
 */
export function resolveGoodsTurnoverBodyState(input: ResolveGoodsTurnoverBodyStateInput): GoodsTurnoverBodyState {
    if (input.error !== null) return 'error'
    if ((input.lines?.length ?? 0) === 0) return 'not-recalculated'
    return 'ready'
}
