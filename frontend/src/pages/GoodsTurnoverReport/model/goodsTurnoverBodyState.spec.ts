import { describe, expect, it } from 'vitest'
import type { GoodsTurnoverReportLineResponse } from 'ireports-contracts'
import { resolveGoodsTurnoverBodyState } from './goodsTurnoverBodyState.ts'

function line(overrides: Partial<GoodsTurnoverReportLineResponse> = {}): GoodsTurnoverReportLineResponse {
    return {
        categoryId: 1,
        categoryName: 'Дисплеи',
        categoryParentId: null,
        warehouseId: 1,
        warehouseName: 'Склад',
        outcomeQuantity: 1,
        outcomeSum: 1,
        stockQuantity: 1,
        stockSum: 1,
        turnoverRatio: null,
        ...overrides,
    }
}

// TDD задачи 19.5-19.6 (openspec/changes/service-turnover-report): «какое состояние показывается
// при loading/error/пустых данных» — loading перехватывается раньше (RefreshTransitionLayout,
// задача 19.1), здесь покрыты оставшиеся три исхода резолвера.
describe('resolveGoodsTurnoverBodyState', () => {
    it('returns "error" when the query failed, regardless of lines', () => {
        expect(resolveGoodsTurnoverBodyState({ error: 'Не удалось загрузить отчёт', lines: undefined })).toBe('error')
        expect(resolveGoodsTurnoverBodyState({ error: 'Не удалось загрузить отчёт', lines: [line()] })).toBe('error')
    })

    it('returns "not-recalculated" when there is no error but the period has zero saved lines', () => {
        expect(resolveGoodsTurnoverBodyState({ error: null, lines: [] })).toBe('not-recalculated')
    })

    it('returns "not-recalculated" when lines is still undefined (defensive default, not "ready")', () => {
        expect(resolveGoodsTurnoverBodyState({ error: null, lines: undefined })).toBe('not-recalculated')
    })

    it('returns "ready" when there is no error and at least one saved line', () => {
        expect(resolveGoodsTurnoverBodyState({ error: null, lines: [line()] })).toBe('ready')
    })
})
