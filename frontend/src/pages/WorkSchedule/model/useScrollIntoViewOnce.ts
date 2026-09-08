import { useEffect, useRef } from 'react'

/**
 * Прокручивает элемент в область видимости один раз при монтировании, если он тогда же был
 * «активным» — переход по `?employeeId=` с мобильного экрана «Отдел сегодня» (план, Фаза 9:
 * «Переход с карточки сотрудника на его график») должен сразу показать нужную строку таблицы,
 * а не заставлять руководителя листать её вручную (31 колонка дня + возможно много сотрудников).
 *
 * `active` намеренно не в зависимостях эффекта — строка не должна дёргаться прокруткой повторно
 * при каждом ререндере таблицы (смена месяца/отдела и так может изменить `active` на `false`,
 * прокручивать в этот момент уже нечего и незачем).
 */
export function useScrollIntoViewOnce<T extends HTMLElement>(active: boolean) {
    const ref = useRef<T>(null)

    useEffect(() => {
        if (active) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
        // eslint-disable-next-line react-hooks/exhaustive-deps -- см. комментарий выше: только при монтировании
    }, [])

    return ref
}
