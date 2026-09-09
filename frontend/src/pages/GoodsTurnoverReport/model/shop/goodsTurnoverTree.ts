import type { ShopGoodsTurnoverReportLine, ShopStore } from 'ireports-contracts'

import type { ShopCategoryRef } from './categoryTree.ts'

// Адаптация `../goodsTurnoverTree.ts` (направление `service`) под контракт отчёта магазина —
// тот же паттерн Ledger Table (ui-design.md, узел `D3Sf4` в `WvSO6`), но:
// - `ShopGoodsTurnoverReportLine` — `categoryId`/`warehouseId` строковые (MoySklad UUID, не
//   числовой RemOnline id) и БЕЗ денормализованных `categoryName`/`categoryParentId`/
//   `warehouseName` (design.md shop-turnover-report: "сервер отдаёт готовое дерево категорий
//   строит фронтенд сам ... поверх уже существующего GET /shop/warehouse/catalog") — их
//   восстанавливает `denormalizeShopReportLines` ниже из каталога/справочника складов до того,
//   как строка попадёт в дерево;
// - поля отчёта названы иначе (`turnoverQuantity`/`turnoverSum`/`coefficient`, не
//   `outcomeQuantity`/`outcomeSum`/`turnoverRatio`) — контракт `shop-goods-turnover-report.ts`,
//   не переименовываем на границе, чтобы не заводить путаницу с "тем же полем под двумя именами".
export type ShopGoodsTurnoverRow = ShopGoodsTurnoverReportLine & {
    categoryName: string
    categoryParentId: string | null
    warehouseName: string
}

/** Достраивает денормализованные имя/родителя категории и имя склада поверх сырых строк отчёта —
 * тот же приём, что `GetGoodsTurnoverReportService` уже делает на бэкенде для `service`, здесь
 * выполняется на фронтенде, т.к. `shop`-контракт этого сознательно не делает (см. комментарий
 * выше). Строка, чьей категории/склада почему-то нет в уже загруженном справочнике (рассинхрон
 * справочника с отчётом), не отбрасывается — получает подстановочные имя/родителя, чтобы не
 * терять данные отчёта из-за отставшего кэша справочника. */
export function denormalizeShopReportLines(
    lines: ShopGoodsTurnoverReportLine[],
    categories: ShopCategoryRef[],
    stores: ShopStore[],
): ShopGoodsTurnoverRow[] {
    const categoryById = new Map(categories.map((c) => [c.id, c]))
    const storeById = new Map(stores.map((s) => [s.id, s]))

    return lines.map((line) => {
        const category = categoryById.get(line.categoryId)
        const store = storeById.get(line.warehouseId)
        return {
            ...line,
            categoryName: category?.name ?? line.categoryId,
            categoryParentId: category?.parentId ?? null,
            warehouseName: store?.name ?? line.warehouseId,
        }
    })
}

export type ShopGoodsTurnoverTreeRow = ShopGoodsTurnoverRow & {
    depth: number
    hasChildren: boolean
    rootIndex: number
}

/**
 * Строит плоский (уже развёрнутый в порядке обхода в глубину) список строк дерева из плоского
 * `ShopGoodsTurnoverRow[]` — портировано из `buildGoodsTurnoverTreeRows` (`../goodsTurnoverTree.ts`)
 * с заменой числового `categoryId` на строковый; логика (реальная глубина/родство по
 * справочнику, а не по наличию строки в отчёте; сортировка сиблингов по алфавиту; циклическая
 * покраска корневых категорий) не менялась, см. комментарии оригинала.
 */
export function buildShopGoodsTurnoverTreeRows(
    rows: ShopGoodsTurnoverRow[],
    categories: ShopCategoryRef[] = [],
): ShopGoodsTurnoverTreeRow[] {
    if (rows.length === 0) return []

    const realParentById = new Map<string, string | null>(rows.map((row) => [row.categoryId, row.categoryParentId]))
    for (const category of categories) realParentById.set(category.id, category.parentId)

    const rowIds = new Set(rows.map((row) => row.categoryId))

    const realDepthAndRoot = (categoryId: string): { depth: number; rootId: string } => {
        let depth = 0
        let current = categoryId
        const seen = new Set<string>([categoryId])
        for (;;) {
            const parentId = realParentById.get(current) ?? null
            if (parentId === null || !realParentById.has(parentId) || seen.has(parentId)) return { depth, rootId: current }
            seen.add(parentId)
            current = parentId
            depth++
        }
    }

    const nearestVisibleParentId = (categoryId: string): string | null => {
        let current = realParentById.get(categoryId) ?? null
        const seen = new Set<string>()
        while (current !== null && !seen.has(current)) {
            if (rowIds.has(current)) return current
            seen.add(current)
            current = realParentById.get(current) ?? null
        }
        return null
    }

    const childrenByVisibleParent = new Map<string | null, ShopGoodsTurnoverRow[]>()
    for (const row of rows) {
        const parentKey = nearestVisibleParentId(row.categoryId)
        const siblings = childrenByVisibleParent.get(parentKey)
        if (siblings) siblings.push(row)
        else childrenByVisibleParent.set(parentKey, [row])
    }

    for (const siblings of childrenByVisibleParent.values()) {
        siblings.sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'ru'))
    }

    const result: ShopGoodsTurnoverTreeRow[] = []
    const rootIndexByRealRoot = new Map<string, number>()
    let nextRootIndex = 0

    const visit = (parentKey: string | null) => {
        const children = childrenByVisibleParent.get(parentKey)
        if (!children) return
        for (const row of children) {
            const { depth, rootId } = realDepthAndRoot(row.categoryId)
            let rootIndex = rootIndexByRealRoot.get(rootId)
            if (rootIndex === undefined) {
                rootIndex = nextRootIndex++
                rootIndexByRealRoot.set(rootId, rootIndex)
            }
            const hasChildren = (childrenByVisibleParent.get(row.categoryId)?.length ?? 0) > 0
            result.push({ ...row, depth, hasChildren, rootIndex })
            visit(row.categoryId)
        }
    }

    visit(null)
    return result
}

/** Портировано без изменений (кроме типа id) из `filterVisibleRows` (`../goodsTurnoverTree.ts`) —
 * см. комментарий оригинала. */
export function filterVisibleShopRows(
    rows: ShopGoodsTurnoverTreeRow[],
    isCollapsed: (categoryId: string) => boolean,
): ShopGoodsTurnoverTreeRow[] {
    const visible: ShopGoodsTurnoverTreeRow[] = []
    let hiddenBelowDepth: number | null = null

    for (const row of rows) {
        if (hiddenBelowDepth !== null) {
            if (row.depth > hiddenBelowDepth) continue
            hiddenBelowDepth = null
        }

        visible.push(row)

        if (row.hasChildren && isCollapsed(row.categoryId)) {
            hiddenBelowDepth = row.depth
        }
    }

    return visible
}

// Портировано без изменений из `../goodsTurnoverTree.ts` (`ROOT_DOT_COLORS`/`getRootDotColor`) —
// см. комментарий оригинала.
export const SHOP_ROOT_DOT_COLORS = ['#22C46A', '#1D4ED8', '#6D28D9', '#C97A2E', '#0EA5A5', '#DB2777']

export function getShopRootDotColor(rootIndex: number): string {
    return SHOP_ROOT_DOT_COLORS[rootIndex % SHOP_ROOT_DOT_COLORS.length]
}

// Портировано без изменений из `../goodsTurnoverTree.ts` (`getRatioColorClass`) — та же шкала
// цвета коэффициента оборачиваемости, `coefficient` (контракт `shop`) вместо `turnoverRatio`
// (контракт `service`) — смысл значения (шт "оборотов" за месяц) идентичен.
export function getShopRatioColorClass(ratio: number | null): string {
    if (ratio === null) return 'text-ink-faint'
    if (ratio >= 1.2) return 'text-ok-ink'
    if (ratio >= 0.85) return 'text-ink'
    if (ratio >= 0.65) return 'text-warn-ink'
    return 'text-danger'
}

export type ShopGoodsTurnoverSummary = {
    turnoverSum: number
    stockSum: number
    stockQuantity: number
    coefficient: number | null
    rootCategoriesCount: number
}

/** Портировано из `summarizeGoodsTurnoverRows` (`../goodsTurnoverTree.ts`) — та же формула
 * (сумма по НАСТОЯЩИМ корневым категориям, средневзвешенный по остатку коэффициент), см.
 * комментарий оригинала за полным обоснованием. */
export function summarizeShopGoodsTurnoverRows(
    rows: ShopGoodsTurnoverRow[],
    categories: ShopCategoryRef[] = [],
): ShopGoodsTurnoverSummary {
    const realParentById = new Map<string, string | null>(rows.map((row) => [row.categoryId, row.categoryParentId]))
    for (const category of categories) realParentById.set(category.id, category.parentId)

    const rootRows = rows.filter((row) => (realParentById.get(row.categoryId) ?? null) === null)

    const turnoverSum = rootRows.reduce((sum, row) => sum + row.turnoverSum, 0)
    const stockSum = rootRows.reduce((sum, row) => sum + row.stockSum, 0)
    const stockQuantity = rootRows.reduce((sum, row) => sum + row.stockQuantity, 0)

    const withRatio = rootRows.filter((row): row is ShopGoodsTurnoverRow & { coefficient: number } => row.coefficient !== null)
    const ratioWeight = withRatio.reduce((sum, row) => sum + row.stockSum, 0)
    const coefficient =
        withRatio.length === 0 || ratioWeight === 0
            ? null
            : withRatio.reduce((sum, row) => sum + row.coefficient * row.stockSum, 0) / ratioWeight

    return { turnoverSum, stockSum, stockQuantity, coefficient, rootCategoriesCount: rootRows.length }
}

// Портировано без изменений из `../goodsTurnoverTree.ts` (`pluralizeCategories`).
export function pluralizeShopCategories(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod10 === 1 && mod100 !== 11) return 'категория'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'категории'
    return 'категорий'
}
