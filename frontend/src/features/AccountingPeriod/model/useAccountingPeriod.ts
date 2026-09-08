import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { SalesDirection } from 'ireports-contracts'

import { api } from './api.ts'

/**
 * Статус расчётного периода направления за месяц (`GET .../period/:period`).
 * `keepPreviousData` — как у useSalesPlan: переключение направления/месяца не должно
 * «мигать» блоком статуса в Page Header, пока грузится новый ответ. Возвращает плоский
 * объект (конвенция model-хуков, frontend/CLAUDE.md): `period` — сырой ответ (или
 * undefined до первой загрузки), `isClosed` — уже вычисленный флаг для веток UI.
 */
export function useAccountingPeriod(direction: SalesDirection, period: string) {
    const query = useQuery({
        ...api.getPeriod(direction, period),
        placeholderData: keepPreviousData,
    })

    return {
        periodStatus: query.data,
        isClosed: query.data?.status === 'CLOSED',
        isLoading: query.isPending,
        error: query.error ? query.error.message : null,
    }
}
