import type { ShopGoodsTurnoverReportLine } from 'ireports-contracts'

import { resolveShopGoodsTurnoverBodyState } from '../../model/shop/goodsTurnoverBodyState.ts'
import type { ShopCategoryRef } from '../../model/shop/categoryTree.ts'
import type { ShopGoodsTurnoverRow } from '../../model/shop/goodsTurnoverTree.ts'
import { GoodsTurnoverErrorState } from '../GoodsTurnoverErrorState.tsx'
import { GoodsTurnoverNotRecalculatedState } from '../GoodsTurnoverNotRecalculatedState.tsx'
import { ShopGoodsTurnoverTable } from './GoodsTurnoverTable'

export type ShopGoodsTurnoverReportBodyProps = {
    error: string | null
    onRetry: () => void
    /** Сырой (нефильтрованный) ответ отчёта — только для выбора состояния
     * (`resolveShopGoodsTurnoverBodyState`: пустой массив => «отчёт ещё не пересчитан»). */
    lines: ShopGoodsTurnoverReportLine[] | undefined
    /** Уже денормализованные и отфильтрованные по складу/категории строки — передаются в
     * `ShopGoodsTurnoverTable` как есть. */
    rows: ShopGoodsTurnoverRow[]
    categories?: ShopCategoryRef[]
    className?: string
}

/**
 * Портировано из `../GoodsTurnoverReportBody.tsx` (направление `service`) — тот же выбор
 * состояния (ошибка / отчёт ещё не пересчитан / таблица), см. комментарий оригинала.
 * `GoodsTurnoverErrorState`/`GoodsTurnoverNotRecalculatedState` переиспользуются как есть — они
 * презентационные и не завязаны на тип id категории/склада.
 */
export function ShopGoodsTurnoverReportBody({ error, onRetry, lines, rows, categories = [], className }: ShopGoodsTurnoverReportBodyProps) {
    const state = resolveShopGoodsTurnoverBodyState({ error, lines })

    if (state === 'error') {
        return <GoodsTurnoverErrorState message={error ?? 'Неизвестная ошибка'} onRetry={onRetry} className={className} />
    }

    if (state === 'not-recalculated') {
        return <GoodsTurnoverNotRecalculatedState className={className} />
    }

    return <ShopGoodsTurnoverTable rows={rows} categories={categories} className={className} />
}
