import type { GoodsTurnoverReportLineResponse } from 'ireports-contracts'

// Дерево строк `GoodsTurnoverTable` (openspec/changes/service-turnover-report, задача 18,
// ui-design.md "Доработка таблицы" — паттерн Ledger, узел `D3Sf4` в `WvSO6`).
//
// `GoodsTurnoverRow` переиспользует контракт `GoodsTurnoverReportLineResponse` как есть
// (`frontend/CLAUDE.md`, "не нужно вручную создавать дублирующие типы для API payload'ов, если
// соответствующий контракт уже существует") — `warehouseId`/`warehouseName` в строке остаются
// (не вырезаны отдельным типом), т.к. вызывающая сторона уже отфильтровала `report.lines` по
// одному складу (architecture.md: "`GoodsTurnoverTable`... для выбранного склада") и передаёт их
// как есть; `GoodsTurnoverTable` их просто не читает.
export type GoodsTurnoverRow = GoodsTurnoverReportLineResponse

// Одна строка уже развёрнутого (flatten) дерева — `depth` определяет число `Rail`-фреймов слева
// от `Marker` (ui-design.md: "по одному Rail 16px на каждый уровень предка"), `hasChildren`
// выбирает иконку `Marker`-а (`Chevron` для узла с потомками, `Dash` для листа — подтверждено
// `Get` по `D3Sf4`: `ut7Jk`/`H0YeG`/`Ok6Qz`/... "Marker" содержат `Dash`, `V7csB`/`DrTeO`/`RCZQq`/...
// содержат `Chevron`), `rootIndex` — порядковый номер корневой (depth 0) категории-предка этой
// строки, используется для циклической покраски `Dot` верхнего уровня (см. `ROOT_DOT_COLORS`
// ниже, тот же приём, что `G7Vnt`/`j6ASa3`/`k4XXNl`/... — палитра из 6 цветов, повторяется по
// кругу).
export type GoodsTurnoverTreeRow = GoodsTurnoverRow & {
    depth: number
    hasChildren: boolean
    rootIndex: number
}

/**
 * Строит плоский (уже развёрнутый в порядке обхода в глубину) список строк дерева из плоского
 * `GoodsTurnoverRow[]` + `categoryParentId` — вложенность произвольной глубины, без капа
 * (ui-design.md: "паттерн один Rail на уровень линейно продолжается на 5+ уровней без изменения
 * логики"). Implements задачу 18.2-18.3 openspec/changes/service-turnover-report (TDD на
 * построение дерева).
 *
 * Категория без движения товара (`turnoverRatio: null`, нулевые расход/остаток) НЕ фильтруется —
 * остаётся обычной строкой таблицы (`specs/service/goods-turnover/spec.md`, "Категория без
 * движения товара").
 *
 * Защитный случай сверх буквального требования задачи: строка, чей `categoryParentId` указывает
 * на категорию, отсутствующую в переданном `rows` (например, `CategoryTreeSelect`, задача 17,
 * отфильтровал `rows` до поддерева одной категории — тогда корень поддерева ссылается на предка
 * вне отфильтрованного набора), трактуется как корень (`depth: 0`), а не отбрасывается молча.
 */
export function buildGoodsTurnoverTreeRows(rows: GoodsTurnoverRow[]): GoodsTurnoverTreeRow[] {
    const idsInSet = new Set(rows.map((row) => row.categoryId))
    const childrenByParent = new Map<number | null, GoodsTurnoverRow[]>()

    for (const row of rows) {
        const parentKey = row.categoryParentId !== null && idsInSet.has(row.categoryParentId) ? row.categoryParentId : null
        const siblings = childrenByParent.get(parentKey)
        if (siblings) siblings.push(row)
        else childrenByParent.set(parentKey, [row])
    }

    const result: GoodsTurnoverTreeRow[] = []
    let nextRootIndex = 0

    const visit = (parentKey: number | null, depth: number, rootIndex: number) => {
        const children = childrenByParent.get(parentKey)
        if (!children) return
        for (const row of children) {
            const resolvedRootIndex = depth === 0 ? nextRootIndex++ : rootIndex
            const hasChildren = (childrenByParent.get(row.categoryId)?.length ?? 0) > 0
            result.push({ ...row, depth, hasChildren, rootIndex: resolvedRootIndex })
            visit(row.categoryId, depth + 1, resolvedRootIndex)
        }
    }

    visit(null, 0, 0)
    return result
}

// Палитра `Dot`-маркера корневых категорий (ui-design.md, `D3Sf4` — 6 цветов, циклически по
// порядковому номеру корневой категории: `G7Vnt` #22C46A, `j6ASa3` #1D4ED8, `k4XXNl` #6D28D9,
// `Tuh0k` #C97A2E, `eVR4N` #0EA5A5, `j6IhbC` #DB2777, дальше цикл повторяется — 7-я корневая
// категория (`wd1x7`) снова #22C46A). Чисто декоративная деталь макета — не завязана на бизнес-
// смысл конкретной категории, поэтому не токенизирована в `shared/ui-kit/tokens/theme.css`
// (page-local, как и весь `Ledger Table`, см. ui-design.md "Новые компоненты UI Kit").
export const ROOT_DOT_COLORS = ['#22C46A', '#1D4ED8', '#6D28D9', '#C97A2E', '#0EA5A5', '#DB2777']

export function getRootDotColor(rootIndex: number): string {
    return ROOT_DOT_COLORS[rootIndex % ROOT_DOT_COLORS.length]
}

// Пороги цвета ячейки «Обор.» (ui-design.md/`D3Sf4`, вычитано по фактическим строкам мокапа —
// `$ok-ink` от 1.20, `$ink` (обычный) от 0.85, `$warn-ink` от 0.65, `$danger` ниже: 0,64/0,61/0,58/
// 0,56 -> danger; 0,68/0,71/0,73/0,84 -> warn-ink; 0,86...0,97 -> ink; 1,20+ -> ok-ink). Решение не
// зафиксировано отдельным FR/UX в proposal.md/spec.md этого change — чисто визуальная деталь
// готового макета, перенесена как задокументированное лучшее приближение к `D3Sf4`, а не
// самостоятельно изобретённое бизнес-правило.
export function getRatioColorClass(ratio: number | null): string {
    if (ratio === null) return 'text-ink-faint'
    if (ratio >= 1.2) return 'text-ok-ink'
    if (ratio >= 0.85) return 'text-ink'
    if (ratio >= 0.65) return 'text-warn-ink'
    return 'text-danger'
}

// Итоговая строка «Итого» (ui-design.md, `tcWPr`) агрегирует расход/остаток по КОРНЕВЫМ (depth 0)
// категориям, а не по всем строкам — подтверждено арифметикой самого мокапа (`D3Sf4`): сумма
// `outcomeSum` дочерних категорий каждой корневой категории в точности равна `outcomeSum` самой
// корневой строки (напр. "Дисплеи" 186 400 = "iPhone" 128 300 + "iPad" 41 200 + "MacBook" 16 900 -
// с точностью округления; "Корпусные детали" 62 800 = "Задние крышки" 41 200 + "Рамки и шасси"
// 21 600), т.е. бэкенд (`BuildGoodsTurnoverReportService`/RemOnline `getGoodsFlowReport` по
// `category_id` родителя) уже отдаёт в строке родительской категории агрегат по всему поддереву.
// Суммирование ВСЕХ строк (а не только корневых) задвоило бы каждую сумму на глубину дерева.
export type GoodsTurnoverSummary = {
    outcomeSum: number
    stockSum: number
    stockQuantity: number
    turnoverRatio: number | null
    rootCategoriesCount: number
}

export function summarizeGoodsTurnoverRows(rows: GoodsTurnoverRow[]): GoodsTurnoverSummary {
    const idsInSet = new Set(rows.map((row) => row.categoryId))
    const rootRows = rows.filter((row) => row.categoryParentId === null || !idsInSet.has(row.categoryParentId))

    const outcomeSum = rootRows.reduce((sum, row) => sum + row.outcomeSum, 0)
    const stockSum = rootRows.reduce((sum, row) => sum + row.stockSum, 0)
    const stockQuantity = rootRows.reduce((sum, row) => sum + row.stockQuantity, 0)

    // Средневзвешенный (по остатку в ₽) коэффициент по строкам с уже посчитанным `turnoverRatio`
    // (`GoodsTurnoverReportLine.calcRatio`, бэкенд) — сам по себе аггрегированный коэффициент не
    // пересчитывается по формуле "расход / средний остаток" заново на фронтенде, потому что
    // остаток ПРОШЛОГО периода (нужен для этой формулы) в `GetGoodsTurnoverReportResponse` не
    // отдаётся вовсе (только текущий месяц) — переиспользуем то, что уже посчитал бэкенд по
    // каждой корневой категории.
    const withRatio = rootRows.filter((row): row is GoodsTurnoverRow & { turnoverRatio: number } => row.turnoverRatio !== null)
    const ratioWeight = withRatio.reduce((sum, row) => sum + row.stockSum, 0)
    const turnoverRatio =
        withRatio.length === 0 || ratioWeight === 0
            ? null
            : withRatio.reduce((sum, row) => sum + row.turnoverRatio * row.stockSum, 0) / ratioWeight

    return { outcomeSum, stockSum, stockQuantity, turnoverRatio, rootCategoriesCount: rootRows.length }
}

export function pluralizeCategories(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod10 === 1 && mod100 !== 11) return 'категория'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'категории'
    return 'категорий'
}
