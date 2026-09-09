import { type ReactNode } from 'react'
import { RefreshTransitionLayout } from '@/shared/ui/RefreshTransitionLayout.tsx'

type Props = {
    isInitialLoad?: boolean
    isRefreshing?: boolean
    dataVersion?: number
    header?: ReactNode
    body?: ReactNode
}

/**
 * Слотовый контейнер страницы `/goods-turnover-report` (openspec/changes/service-turnover-report,
 * задача 15) — именованные слоты `header`/`body` + `RefreshTransitionLayout`
 * (`isInitialLoad`/`isRefreshing`/`dataVersion`, `frontend/CLAUDE.md`).
 *
 * Отклонение от задачи 15.1 (изначально "точная копия паттерна `pages/ServicesReport/ui/
 * Layout.tsx`", включая отдельный слот `error` + generic `ErrorLayout`-баннер): задача 19
 * (`ui-design.md` "Ключевые состояния") специфицирует для ошибки загрузки отдельную полноценную
 * карточку внутри контентной зоны (иконка/заголовок/описание/кнопка «Повторить» — `Error State`,
 * узлы `W2qBFM`/`SSiyp`), а не баннер над таблицей вдобавок к самой таблице. Эта карточка теперь
 * часть `GoodsTurnoverReportBody` (презентационный компонент, ветвящийся по состоянию:
 * ошибка/«ещё не пересчитан»/таблица) — `error` больше не проп `Layout`, чтобы не рендерить его
 * дважды (баннер здесь + карточка в `body`).
 */
export function Layout({ isInitialLoad, isRefreshing = false, dataVersion = 0, header, body }: Props) {
    return (
        <main className="flex flex-1 flex-col gap-4 bg-canvas px-4 py-5 md:px-7 md:py-6">
            {header}
            <RefreshTransitionLayout isInitialLoad={isInitialLoad} isRefreshing={isRefreshing} dataVersion={dataVersion}>
                {body}
            </RefreshTransitionLayout>
        </main>
    )
}
