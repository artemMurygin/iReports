import type { ReactNode } from 'react'

export type LayoutProps = {
    header?: ReactNode
    target?: ReactNode
    rules?: ReactNode
    mobileBar?: ReactNode
}

/**
 * Локальный аналог `pages/SalaryRules/ui/Layout` — та же раскладка (шапка, read-only карточка
 * цели слева/сверху, список правил справа/снизу, мобильный sticky-бар), но не импортируется
 * оттуда напрямую (page→page запрещён, frontend/CLAUDE.md), поэтому продублирован здесь: файл
 * тривиален (только раскладка слотов), а у "Создать"/"Сохранить" сценариев разные заголовки и
 * набор карточки цели (редактируемая vs read-only), так что переиспользование дало бы условную
 * ветвистость внутри общего компонента вместо двух простых.
 *
 * `mobileBar` — последний потомок `<main>` (вместе с `mt-auto` на самом баре даёт классический
 * "sticky footer", прижатый к низу `bottom-0` на коротких страницах).
 */
export function Layout({ header, target, rules, mobileBar }: LayoutProps) {
    return (
        <main className="flex flex-1 flex-col bg-canvas">
            <div className="flex flex-col gap-4 px-4 py-5 md:px-7 md:py-6">
                {header}

                <div className="flex w-full flex-col gap-5 md:flex-row md:items-start">
                    {target}

                    {rules}
                </div>
            </div>

            {mobileBar}
        </main>
    )
}
