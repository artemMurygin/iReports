import type { ReactNode } from 'react'

export type LayoutProps = {
    header?: ReactNode
    banner?: ReactNode
    target?: ReactNode
    rules?: ReactNode
    mobileBar?: ReactNode
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `tSYIw` (`Зарплатное правило · Создание
 * (Сервис)`, desktop) и `ZMEof` (`Зарплатное правило · Создание (Магазин)`) — каркас страницы
 * создания схемы: шапка, зелёный баннер успешного сохранения, две колонки (Шаг 1 — `target`,
 * Шаг 2 — `rules`) и мобильный sticky-бар.
 *
 * Фаза 5 (mobile adaptive, docs/salary-schema-creation-ui): узлы `IScAL`/`AmfHy` складывают Шаг 1 и
 * Шаг 2 в одну колонку ниже `md:` (это и делает десктопный `md:flex-row` ниже), а "Сохранить схему"
 * переезжает в sticky-бар внизу (`mobileBar`, `md:hidden`) вместо кнопки в шапке
 * (`hidden md:inline-flex` у той). Слот `mobileBar` остаётся последним потомком `<main>` (вместе с
 * `mt-auto` на самом баре это даёт классический "sticky footer", прижатый к низу `bottom-0` на
 * коротких страницах).
 *
 * Слоты именованные (frontend/CLAUDE.md, "Слоты вместо `children`"): Layout не знает, что лежит
 * внутри, и содержит только раскладку.
 */
export function Layout({ header, banner, target, rules, mobileBar }: LayoutProps) {
    return (
        <main className="flex flex-1 flex-col bg-canvas">
            <div className="flex flex-col gap-4 px-4 py-5 md:px-7 md:py-6">
                {header}

                {banner}

                <div className="flex w-full flex-col gap-5 md:flex-row md:items-start">
                    {target}

                    {rules}
                </div>
            </div>

            {mobileBar}
        </main>
    )
}
