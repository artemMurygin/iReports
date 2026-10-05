import type { CategoryTree } from '../categoryTree'
import type { CreateServiceRow, ServiceCategory } from '@/shared/gas/types'

/**
 * Pure port of the reference sidebar's bulk-create-services validation/payload-building logic
 * (frontend/GoogleSheetsInterface/index.html lines ~986-1070). No React, no `gas` import — plain
 * functions over plain data, so they're trivially unit-testable in isolation.
 */

/** RemOnline price-list key the "Цена услуги" column is written under. */
export const RO_PRICE_KEY = '543835'

export const CREATE_SERVICE_REQUIRED_FIELDS: [keyof CreateServiceRow, string][] = [
    ['deviceType', 'Тип устройства (G)'],
    ['deviceModel', 'Модель устройства (H)'],
    ['partQuality', 'Качество запчасти (I)'],
    ['name', 'Наименование услуги (J)'],
    ['category', 'Категория (K)'],
    ['warranty', 'Срок гарантии (L)'],
    ['warrantyPeriod', 'Период гарантии (M)'],
    ['engineerBonus', 'Начисление мастеру (BU)'],
    ['price', 'Цена услуги (AY)'],
]

/** The RemOnline "create service" payload shape, exactly as sent by the reference. */
export interface CreateServicePayload {
    category_id: number
    earnings_sum: number
    prices: Record<string, number>
    title: string
    warranty: number
    warranty_period: number
}

export function isEmptyCell(value: unknown): boolean {
    return value === '' || value === null || value === undefined
}

export function toNumber(value: unknown): number | null {
    if (typeof value === 'number') return isFinite(value) ? value : null
    if (typeof value !== 'string') return null
    const normalized = value.replace(/\s+/g, '').replace(',', '.')
    if (normalized === '') return null
    const num = Number(normalized)
    return isFinite(num) ? num : null
}

export function parseWarrantyPeriod(value: unknown): number | null {
    const normalized = String(value).trim().toLowerCase()
    if (normalized.startsWith('дн')) return 0
    if (normalized.startsWith('мес')) return 1
    return null
}

/**
 * Resolves a "A > B > C" category path to an id by walking it from the root, level by level
 * (each segment must be a direct child of the previous one). Matching only the last segment's
 * name is NOT enough: RemOnline has same-named categories in different branches (e.g. "Дисплеи"
 * under both iPhone and iPad), so a flat name lookup lands the service in the wrong branch.
 *
 * Returns `null` when the path is empty or some segment doesn't exist under its parent; throws
 * when a level has several same-named siblings (the path itself is ambiguous — nothing to guess).
 */
export function resolveCategoryId(categoryPath: unknown, tree: CategoryTree): number | null {
    const segments = String(categoryPath)
        .split('>')
        .map((s) => s.trim())
        .filter(Boolean)
    if (segments.length === 0) return null

    let parentId: number | null = null
    for (const segment of segments) {
        const matches: ServiceCategory[] = (tree.byParent.get(parentId) ?? []).filter((c) => c.name.trim() === segment)
        if (matches.length === 0) return null
        if (matches.length > 1) {
            throw new Error('Категория указана неоднозначно (одинаковые названия на одном уровне): ' + segment)
        }
        parentId = matches[0].id
    }
    return parentId
}

export function buildServiceTitle(row: CreateServiceRow): string {
    const parts = [row.name, row.deviceType, row.deviceModel].map((p) => String(p).trim()).filter(Boolean)
    let title = parts.join(' ')
    if (!isEmptyCell(row.modelNumber)) title += ` (${String(row.modelNumber).trim()})`
    if (!isEmptyCell(row.partQuality)) title += ` | ${String(row.partQuality).trim()}`
    return title
}

export function buildCreateServicePayload(row: CreateServiceRow, tree: CategoryTree): CreateServicePayload {
    const missing = CREATE_SERVICE_REQUIRED_FIELDS.filter(([key]) => isEmptyCell(row[key])).map(([, label]) => label)
    if (missing.length > 0) {
        throw new Error('Не заполнены поля: ' + missing.join(', '))
    }

    const categoryId = resolveCategoryId(row.category, tree)
    if (categoryId === null) {
        throw new Error('Категория не найдена: ' + String(row.category))
    }

    const warrantyPeriod = parseWarrantyPeriod(row.warrantyPeriod)
    if (warrantyPeriod === null) {
        throw new Error('Период гарантии указан неверно (укажите «дн.» или «мес.»): ' + String(row.warrantyPeriod))
    }

    const warranty = toNumber(row.warranty)
    const engineerBonus = toNumber(row.engineerBonus)
    const price = toNumber(row.price)
    if (warranty === null || engineerBonus === null || price === null) {
        throw new Error('Срок гарантии, начисление мастеру и цена услуги должны быть числами')
    }

    return {
        category_id: categoryId,
        earnings_sum: engineerBonus,
        prices: { [RO_PRICE_KEY]: price },
        title: buildServiceTitle(row),
        warranty: warranty,
        warranty_period: warrantyPeriod,
    }
}
