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

// Минимальная форма записи справочника категорий, нужная дереву — `ListProductCategoriesService`
// (тот же справочник, что уже грузит `CategoryTreeSelect`, задача 17) отдаёт больше полей, но
// здесь важны только id/parentId.
export type ProductCategoryRef = { id: number; parentId: number | null }

// Одна строка уже развёрнутого (flatten) дерева — `depth` определяет число `Rail`-фреймов слева
// от `Marker` (ui-design.md: "по одному Rail 16px на каждый уровень предка") и вычисляется по
// РЕАЛЬНОЙ цепочке предков из справочника категорий (см. `buildGoodsTurnoverTreeRows`), а не по
// тому, у скольких из них есть строка в отчёте — иначе категория, чей родитель не попал в отчёт
// (например, RemOnline не вернул по нему данные за период), ошибочно всплывала бы на верхний
// уровень как самостоятельная корневая категория. `hasChildren` выбирает иконку `Marker`-а
// (`Chevron` для узла с потомками, `Dash` для листа — подтверждено `Get` по `D3Sf4`:
// `ut7Jk`/`H0YeG`/`Ok6Qz`/... "Marker" содержат `Dash`, `V7csB`/`DrTeO`/`RCZQq`/... содержат
// `Chevron`), `rootIndex` — порядковый номер РЕАЛЬНОЙ корневой (`parentId: null` в справочнике)
// категории-предка этой строки, используется для циклической покраски `Dot` верхнего уровня (см.
// `ROOT_DOT_COLORS` ниже, тот же приём, что `G7Vnt`/`j6ASa3`/`k4XXNl`/... — палитра из 6 цветов,
// повторяется по кругу); `Dot` рисуется только при `depth === 0` — строка с "дырой" в предках
// (см. выше) свой настоящий `rootIndex` несёт, но точку не показывает, раз сама не является
// настоящим корнем.
export type GoodsTurnoverTreeRow = GoodsTurnoverRow & {
    depth: number
    hasChildren: boolean
    rootIndex: number
}

/**
 * Строит плоский (уже развёрнутый в порядке обхода в глубину) список строк дерева из плоского
 * `GoodsTurnoverRow[]` — вложенность произвольной глубины, без капа (ui-design.md: "паттерн один
 * Rail на уровень линейно продолжается на 5+ уровней без изменения логики"). Implements задачу
 * 18.2-18.3 openspec/changes/service-turnover-report (TDD на построение дерева).
 *
 * `categories` — полный справочник категорий (`ListProductCategoriesService`, тот же, что грузит
 * `CategoryTreeSelect`) — источник истины для `depth`/родства, а не сам `rows`: отчёт за период
 * содержит только категории, по которым ERP вернул данные (частичный успех бэкенда,
 * `BuildGoodsTurnoverReportService` design.md D6 — сбой одной пары категория-склад не прерывает
 * построение остальных), поэтому у части строк реальный родитель может отсутствовать в `rows`, но
 * присутствовать в полном справочнике. Опущенный/пустой `categories` — сохраняет прежнее
 * поведение "родство только по `rows`" (тесты, вызовы без справочника под рукой).
 *
 * Категория без движения товара (`turnoverRatio: null`, нулевые расход/остаток) НЕ фильтруется —
 * остаётся обычной строкой таблицы (`specs/service/goods-turnover/spec.md`, "Категория без
 * движения товара").
 *
 * Строка, чей ближайший ЕСТЬ-В-`rows` предок отсутствует (сам предок без данных, его предок тоже
 * без данных, и так вплоть до настоящего корня справочника — либо `categories` вообще не
 * передан), группируется как визуальный "верхний" узел списка (не имеет видимого родителя над
 * собой), но её `depth` остаётся РЕАЛЬНЫМ (числом настоящих предков по справочнику) — то есть она
 * не притворяется корнем визуально (`isTopLevel`/`Dot` в `GoodsTurnoverTable` завязаны на
 * `depth === 0`, а не на позицию в списке).
 *
 * Сиблинги на каждом уровне сортируются по алфавиту (`categoryName.localeCompare(_, 'ru')` —
 * тот же приём, что уже применяет `CategoryTreeSelect` этой же страницы для дерева фильтра) —
 * порядок в исходном `rows` (порядок ответа бэкенда) не гарантирован и не имеет бизнес-смысла для
 * пользователя таблицы.
 */
export function buildGoodsTurnoverTreeRows(rows: GoodsTurnoverRow[], categories: ProductCategoryRef[] = []): GoodsTurnoverTreeRow[] {
    if (rows.length === 0) return []

    // Реальный родитель по справочнику — приоритетный источник; для категорий, которых почему-то
    // нет в справочнике (пустой `categories`, рассинхрон справочника с отчётом), падаем обратно на
    // `categoryParentId` из самой строки отчёта — прежнее поведение.
    const realParentById = new Map<number, number | null>(rows.map((row) => [row.categoryId, row.categoryParentId]))
    for (const category of categories) realParentById.set(category.id, category.parentId)

    const rowIds = new Set(rows.map((row) => row.categoryId))

    const realDepthAndRoot = (categoryId: number): { depth: number; rootId: number } => {
        let depth = 0
        let current = categoryId
        const seen = new Set<number>([categoryId])
        for (;;) {
            const parentId = realParentById.get(current) ?? null
            if (parentId === null || !realParentById.has(parentId) || seen.has(parentId)) return { depth, rootId: current }
            seen.add(parentId)
            current = parentId
            depth++
        }
    }

    // Ближайший предок, у которого ЕСТЬ строка в отчёте — определяет визуальное соседство
    // (под какой видимой строкой рисуется эта) в отличие от `depth` (числа Rail), который считаем
    // по реальному, а не "видимому" родству.
    const nearestVisibleParentId = (categoryId: number): number | null => {
        let current = realParentById.get(categoryId) ?? null
        const seen = new Set<number>()
        while (current !== null && !seen.has(current)) {
            if (rowIds.has(current)) return current
            seen.add(current)
            current = realParentById.get(current) ?? null
        }
        return null
    }

    const childrenByVisibleParent = new Map<number | null, GoodsTurnoverRow[]>()
    for (const row of rows) {
        const parentKey = nearestVisibleParentId(row.categoryId)
        const siblings = childrenByVisibleParent.get(parentKey)
        if (siblings) siblings.push(row)
        else childrenByVisibleParent.set(parentKey, [row])
    }

    for (const siblings of childrenByVisibleParent.values()) {
        siblings.sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'ru'))
    }

    const result: GoodsTurnoverTreeRow[] = []
    const rootIndexByRealRoot = new Map<number, number>()
    let nextRootIndex = 0

    const visit = (parentKey: number | null) => {
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

/**
 * Убирает из уже развёрнутого (`buildGoodsTurnoverTreeRows`) списка все строки, чей ближайший
 * видимый предок свёрнут (`isCollapsed`) — сама свёрнутая строка-предок остаётся видимой,
 * скрываются только строки строго глубже неё, вплоть до следующей строки той же (или меньшей)
 * глубины. Список уже в порядке обхода в глубину (родитель непосредственно перед всеми своими
 * потомками), поэтому одного линейного прохода достаточно.
 */
export function filterVisibleRows(
    rows: GoodsTurnoverTreeRow[],
    isCollapsed: (categoryId: number) => boolean,
): GoodsTurnoverTreeRow[] {
    const visible: GoodsTurnoverTreeRow[] = []
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

// Итоговая строка «Итого» (ui-design.md, `tcWPr`) агрегирует расход/остаток по НАСТОЯЩИМ корневым
// (реальный `parentId: null` в справочнике категорий, а не просто "родителя нет в `rows`" — та же
// поправка, что и в `buildGoodsTurnoverTreeRows` выше) категориям, а не по всем строкам —
// подтверждено арифметикой самого мокапа (`D3Sf4`): сумма `outcomeSum` дочерних категорий каждой
// корневой категории в точности равна `outcomeSum` самой корневой строки (напр. "Дисплеи" 186 400
// = "iPhone" 128 300 + "iPad" 41 200 + "MacBook" 16 900 - с точностью округления; "Корпусные
// детали" 62 800 = "Задние крышки" 41 200 + "Рамки и шасси" 21 600), т.е. бэкенд
// (`BuildGoodsTurnoverReportService`/RemOnline `getGoodsFlowReport` по `category_id` родителя) уже
// отдаёт в строке родительской категории агрегат по всему поддереву. Суммирование ВСЕХ строк
// (а не только корневых) задвоило бы каждую сумму на глубину дерева. Категория, чей настоящий
// корень-предок не вернул данные за период (частичный успех бэкенда), в сумму не попадает — её
// агрегат просто неизвестен без строки корня, досчитывать его снизу вверх было бы отдельным,
// самостоятельно изобретённым бизнес-правилом.
export type GoodsTurnoverSummary = {
    outcomeSum: number
    stockSum: number
    stockQuantity: number
    turnoverRatio: number | null
    rootCategoriesCount: number
}

export function summarizeGoodsTurnoverRows(rows: GoodsTurnoverRow[], categories: ProductCategoryRef[] = []): GoodsTurnoverSummary {
    const realParentById = new Map<number, number | null>(rows.map((row) => [row.categoryId, row.categoryParentId]))
    for (const category of categories) realParentById.set(category.id, category.parentId)

    const rootRows = rows.filter((row) => (realParentById.get(row.categoryId) ?? null) === null)

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
