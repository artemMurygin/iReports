import { describe, expect, it } from 'vitest'

import { ALL_DEPARTMENTS_VALUE, buildDepartmentSelectOptions, resolveDepartmentLabel } from './departmentOptions.ts'

const DEPARTMENTS = [
    { id: 1, name: 'Отдел сервиса' },
    { id: 2, name: 'Магазин' },
]

describe('buildDepartmentSelectOptions', () => {
    it('leads with "Все отделы" (id: null) before the real departments', () => {
        const options = buildDepartmentSelectOptions(DEPARTMENTS)
        expect(options[0]).toEqual({ value: ALL_DEPARTMENTS_VALUE, id: null, label: 'Все отделы' })
        expect(options.slice(1)).toEqual([
            { value: '1', id: 1, label: 'Отдел сервиса' },
            { value: '2', id: 2, label: 'Магазин' },
        ])
    })

    it('is just the "Все отделы" sentinel when the directory is empty', () => {
        expect(buildDepartmentSelectOptions([])).toHaveLength(1)
    })
})

describe('resolveDepartmentLabel', () => {
    const options = buildDepartmentSelectOptions(DEPARTMENTS)

    it('resolves null to "Все отделы"', () => {
        expect(resolveDepartmentLabel(options, null)).toBe('Все отделы')
    })

    it('resolves a known departmentId to its name', () => {
        expect(resolveDepartmentLabel(options, 2)).toBe('Магазин')
    })

    it('falls back to "Все отделы" for an id not in the list (directory still loading)', () => {
        expect(resolveDepartmentLabel(options, 999)).toBe('Все отделы')
    })
})
