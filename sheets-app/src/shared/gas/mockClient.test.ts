import { describe, expect, it } from 'vitest'
import { mockGasClient } from './mockClient'
import type { AccrualsSheetEntry } from './types'

describe('mockGasClient.applyAccrualsUpdates', () => {
    it('only returns ids present in earningsById, ignoring ids that are absent', async () => {
        const entries: AccrualsSheetEntry[] = [
            { id: 'a', row: 5, value: 100 },
            { id: 'b', row: 6, value: 200 },
        ]
        // 'b' has no entry in earningsById at all -> must not be reported as updated.
        const earningsById = { a: 999 }

        const updated = await mockGasClient.applyAccrualsUpdates(entries, earningsById)

        expect(updated).toEqual(['a'])
    })

    it('skips ids whose value already equals the new value', async () => {
        const entries: AccrualsSheetEntry[] = [
            { id: 'a', row: 5, value: 100 },
            { id: 'b', row: 6, value: 200 },
        ]
        const earningsById = { a: 100, b: 200 } // both unchanged

        const updated = await mockGasClient.applyAccrualsUpdates(entries, earningsById)

        expect(updated).toEqual([])
    })

    it('returns exactly the ids whose value differs, in encounter order, for a mixed batch', async () => {
        const entries: AccrualsSheetEntry[] = [
            { id: 'a', row: 5, value: 100 }, // unchanged
            { id: 'b', row: 6, value: 200 }, // changes
            { id: 'c', row: 7, value: 300 }, // absent from earningsById
            { id: 'd', row: 8, value: 0 }, // changes
        ]
        const earningsById = { a: 100, b: 250, d: 5 }

        const updated = await mockGasClient.applyAccrualsUpdates(entries, earningsById)

        expect(updated).toEqual(['b', 'd'])
    })

    it('operates on whatever entries/earningsById it is called with, not fixed internal fixtures', async () => {
        const entries: AccrualsSheetEntry[] = [{ id: 'zzz-not-a-fixture-id', row: 42, value: 'old' }]
        const earningsById = { 'zzz-not-a-fixture-id': 'old' as unknown as number }

        const updated = await mockGasClient.applyAccrualsUpdates(entries, earningsById)

        expect(updated).toEqual([])
    })
})

describe('mockGasClient.getServiceCategories', () => {
    it('returns a non-empty array where every non-root parentId points at a real id in the array', async () => {
        const categories = await mockGasClient.getServiceCategories()

        expect(categories.length).toBeGreaterThan(0)

        const ids = new Set(categories.map((category) => category.id))
        for (const category of categories) {
            if (category.parentId === null) continue
            expect(ids.has(category.parentId)).toBe(true)
        }
    })

    it('contains at least one multi-level branch (a node whose parent is itself non-root)', async () => {
        const categories = await mockGasClient.getServiceCategories()
        const byId = new Map(categories.map((category) => [category.id, category]))

        const hasThreeLevelChain = categories.some((category) => {
            if (category.parentId === null) return false
            const parent = byId.get(category.parentId)
            return parent !== undefined && parent.parentId !== null
        })

        expect(hasThreeLevelChain).toBe(true)
    })
})
