import type { GoodsTurnoverReportLineResponse } from 'ireports-contracts'

import { resolveGoodsTurnoverBodyState } from '../model/goodsTurnoverBodyState.ts'
import type { GoodsTurnoverRow, ProductCategoryRef } from '../model/goodsTurnoverTree.ts'
import { GoodsTurnoverErrorState } from './GoodsTurnoverErrorState.tsx'
import { GoodsTurnoverNotRecalculatedState } from './GoodsTurnoverNotRecalculatedState.tsx'
import { GoodsTurnoverTable } from './GoodsTurnoverTable'

export type GoodsTurnoverReportBodyProps = {
    error: string | null
    onRetry: () => void
    /** Сырой (нефильтрованный) список строк отчёта — только для выбора состояния
     * (`resolveGoodsTurnoverBodyState`: пустой список => «отчёт ещё не пересчитан»). */
    lines: GoodsTurnoverReportLineResponse[] | undefined
    /** Уже отфильтрованные по складу/категории строки — передаются в `GoodsTurnoverTable` как есть. */
    rows: GoodsTurnoverRow[]
    /** Полный справочник категорий — прокидывается в `GoodsTurnoverTable` как есть, см. её пропс. */
    categories?: ProductCategoryRef[]
    className?: string
}

/**
 * Презентационный компонент тела отчёта `/goods-turnover-report` (openspec/changes/
 * service-turnover-report, задача 19.1-19.3; frontend/CLAUDE.md — "любое такое ветвление
 * выносится в отдельный презентационный компонент") — единственное место в этой странице, где
 * есть условный рендер по состоянию: ошибка / отчёт ещё не пересчитан / обычная таблица. Медиатор
 * (`GoodsTurnoverReportPage.tsx`) просто передаёт сюда готовые пропсы, сам не ветвится.
 *
 * Загрузка (`isInitialLoad`) сюда не доходит — `Layout`/`RefreshTransitionLayout` перехватывает её
 * раньше и вообще не рендерит `body` (задача 19.1, `SpinnerPageLg`).
 */
export function GoodsTurnoverReportBody({ error, onRetry, lines, rows, categories = [], className }: GoodsTurnoverReportBodyProps) {
    const state = resolveGoodsTurnoverBodyState({ error, lines })

    if (state === 'error') {
        return <GoodsTurnoverErrorState message={error ?? 'Неизвестная ошибка'} onRetry={onRetry} className={className} />
    }

    if (state === 'not-recalculated') {
        return <GoodsTurnoverNotRecalculatedState className={className} />
    }

    return <GoodsTurnoverTable rows={rows} categories={categories} className={className} />
}
