import { describe, expect, it } from 'vitest'
import {
    RO_PRICE_KEY,
    buildCreateServicePayload,
    buildServiceTitle,
    isEmptyCell,
    parseWarrantyPeriod,
    resolveCategoryId,
    toNumber,
} from './validation'
import { buildCategoryTree } from '../categoryTree'
import type { ServiceCategory } from '@/shared/gas/types'
import type { CreateServiceRow } from '@/shared/gas/types'

const CATEGORIES: ServiceCategory[] = [
    { id: 1, name: 'Ремонт', parentId: null },
    { id: 10, name: 'iPhone', parentId: 1 },
    { id: 100, name: 'Замена экрана', parentId: 10 },
]

const TREE = buildCategoryTree(CATEGORIES)

function validRow(overrides: Partial<CreateServiceRow> = {}): CreateServiceRow {
    return {
        row: 5,
        deviceType: 'Смартфон',
        deviceModel: 'iPhone 13',
        partQuality: 'Оригинал',
        name: 'Замена экрана',
        category: 'Ремонт > iPhone > Замена экрана',
        warranty: 12,
        warrantyPeriod: 'мес.',
        modelNumber: '',
        engineerBonus: 500,
        price: '1 500,50',
        ...overrides,
    }
}

describe('isEmptyCell', () => {
    it('treats only "", null and undefined as empty', () => {
        expect(isEmptyCell('')).toBe(true)
        expect(isEmptyCell(null)).toBe(true)
        expect(isEmptyCell(undefined)).toBe(true)
        expect(isEmptyCell(0)).toBe(false)
        expect(isEmptyCell('0')).toBe(false)
    })
})

describe('toNumber', () => {
    it('passes finite numbers through unchanged', () => {
        expect(toNumber(12)).toBe(12)
    })

    it('rejects non-finite numbers', () => {
        expect(toNumber(Infinity)).toBeNull()
        expect(toNumber(NaN)).toBeNull()
    })

    it('parses numeric strings, stripping whitespace and treating comma as a decimal point', () => {
        expect(toNumber('1 500,50')).toBe(1500.5)
        expect(toNumber(' 12 ')).toBe(12)
    })

    it('returns null for an empty or non-numeric string', () => {
        expect(toNumber('')).toBeNull()
        expect(toNumber('abc')).toBeNull()
    })
})

describe('parseWarrantyPeriod', () => {
    it('maps a "дн..." prefix (any case/whitespace) to 0', () => {
        expect(parseWarrantyPeriod('дн.')).toBe(0)
        expect(parseWarrantyPeriod('  ДНЕЙ ')).toBe(0)
    })

    it('maps a "мес..." prefix (any case/whitespace) to 1', () => {
        expect(parseWarrantyPeriod('мес.')).toBe(1)
        expect(parseWarrantyPeriod('  Месяцев ')).toBe(1)
    })

    it('returns null for anything else', () => {
        expect(parseWarrantyPeriod('лет')).toBeNull()
        expect(parseWarrantyPeriod('')).toBeNull()
    })
})

describe('resolveCategoryId', () => {
    it('resolves the full path from the root, trimming segments', () => {
        expect(resolveCategoryId('Ремонт > iPhone > Замена экрана', TREE)).toBe(100)
        expect(resolveCategoryId('  Ремонт >  iPhone > Замена экрана  ', TREE)).toBe(100)
    })

    it('resolves intermediate levels too', () => {
        expect(resolveCategoryId('Ремонт > iPhone', TREE)).toBe(10)
    })

    it('picks the category from the right branch when the same name exists in several branches', () => {
        const tree = buildCategoryTree([
            { id: 1, name: 'Ремонт', parentId: null },
            { id: 10, name: 'iPhone', parentId: 1 },
            { id: 11, name: 'iPad', parentId: 1 },
            { id: 100, name: 'Дисплеи', parentId: 10 },
            { id: 110, name: 'Дисплеи', parentId: 11 },
        ])

        expect(resolveCategoryId('Ремонт > iPhone > Дисплеи', tree)).toBe(100)
        expect(resolveCategoryId('Ремонт > iPad > Дисплеи', tree)).toBe(110)
    })

    it('returns null when the path has no non-empty segments', () => {
        expect(resolveCategoryId('', TREE)).toBeNull()
        expect(resolveCategoryId('>>', TREE)).toBeNull()
    })

    it('returns null when a segment does not exist under its parent', () => {
        expect(resolveCategoryId('Ремонт > Неизвестная категория', TREE)).toBeNull()
        // exists, but not directly under the root — a bare/partial name must not match
        expect(resolveCategoryId('Замена экрана', TREE)).toBeNull()
        expect(resolveCategoryId('Ремонт > Замена экрана', TREE)).toBeNull()
    })

    it('throws when same-named siblings make the path ambiguous', () => {
        const tree = buildCategoryTree([
            { id: 1, name: 'Ремонт', parentId: null },
            { id: 10, name: 'iPhone', parentId: 1 },
            { id: 11, name: 'iPhone ', parentId: 1 },
        ])

        expect(() => resolveCategoryId('Ремонт > iPhone', tree)).toThrow('неоднозначно')
    })
})

describe('buildServiceTitle', () => {
    it('joins name/deviceType/deviceModel/partQuality with spaces, dropping empty parts', () => {
        const row = validRow({ name: 'Замена', deviceType: 'Смартфон', deviceModel: 'iPhone 13', partQuality: '' })
        expect(buildServiceTitle(row)).toBe('Замена Смартфон iPhone 13')
    })

    it('appends " (modelNumber)" when modelNumber is non-empty', () => {
        const row = validRow({
            name: 'Замена',
            deviceType: 'Смартфон',
            deviceModel: 'iPhone 13',
            partQuality: 'Оригинал',
            modelNumber: ' A2482 ',
        })
        expect(buildServiceTitle(row)).toBe('Замена Смартфон iPhone 13 Оригинал (A2482)')
    })
})

describe('buildCreateServicePayload', () => {
    it('throws listing every missing required field, in declaration order', () => {
        const row = validRow({ deviceType: '', category: null, price: undefined })
        expect(() => buildCreateServicePayload(row, TREE)).toThrow(
            'Не заполнены поля: Тип устройства (G), Категория (K), Цена услуги (AY)',
        )
    })

    it('throws with the offending category path when the category cannot be resolved', () => {
        const row = validRow({ category: 'Ремонт > Неизвестная' })
        expect(() => buildCreateServicePayload(row, TREE)).toThrow('Категория не найдена: Ремонт > Неизвестная')
    })

    it('throws the exact message when warrantyPeriod is missing/invalid', () => {
        const row = validRow({ warrantyPeriod: 'лет' })
        expect(() => buildCreateServicePayload(row, TREE)).toThrow(
            'Период гарантии указан неверно (укажите «дн.» или «мес.»): лет',
        )
    })

    it('throws the numeric-fields message when warranty/engineerBonus/price are not numbers', () => {
        const row = validRow({ price: 'бесплатно' })
        expect(() => buildCreateServicePayload(row, TREE)).toThrow(
            'Срок гарантии, начисление мастеру и цена услуги должны быть числами',
        )
    })

    it('builds the exact RemOnline payload shape for a fully valid row', () => {
        const row = validRow()
        expect(buildCreateServicePayload(row, TREE)).toEqual({
            category_id: 100,
            earnings_sum: 500,
            prices: { [RO_PRICE_KEY]: 1500.5 },
            title: 'Замена экрана Смартфон iPhone 13 Оригинал',
            warranty: 12,
            warranty_period: 1,
        })
    })
})
