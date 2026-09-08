import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { UpsertWorkScheduleEntryRequest, WorkScheduleEntryResponse } from 'ireports-contracts'

import { api, WORK_SCHEDULE_QUERY_KEY_PREFIX } from './api.ts'

/**
 * Мутация одной ячейки графика (Фаза 7 «Редактирование дня», docs/employee-work-schedule) — тонкая
 * обёртка над `api.upsertEntry` (frontend/CLAUDE.md, «Query options factory»): владеет только
 * инвалидацией и уведомлением об ошибке, вся логика «что сохранять» уже посчитана вызывающим
 * (`useDayEditor.ts`) через чистые функции `model/dayEditorPayload.ts`.
 *
 * Инвалидирует ВЕСЬ префикс `work-schedule` (месяц И состав смены на дату, Фаза 4), а не только
 * запрошенный месяц: у страницы графика (Фаза 6) уже открыт конкретный месяц/отдел, но тот же
 * PUT-эндпоинт видит и мобильный экран «Отдел сегодня» (Фаза 9) — после сохранения дня его список
 * состава смены тоже должен обновиться при следующем открытии, а не показывать данные до правки.
 * Именно инвалидация (а не оптимистичный патч кэша) даёт «пересчёт итогов» бесплатно: часы
 * сотрудника, «Человек в смене» за день и общий фонд считает бэкенд при рефетче месяца — фронту не
 * нужно дублировать эту арифметику.
 */
export function useSaveWorkScheduleEntry() {
    const queryClient = useQueryClient()

    return useMutation<WorkScheduleEntryResponse, Error, UpsertWorkScheduleEntryRequest>({
        mutationFn: (payload) => api.upsertEntry(payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: WORK_SCHEDULE_QUERY_KEY_PREFIX })
        },
        onError: (error) => {
            toast.error('Не удалось сохранить день графика', { description: error.message })
        },
    })
}
