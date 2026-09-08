import { describe, expect, it } from 'vitest'

import { parseHighlightedEmployeeId } from './employeeHighlight.ts'

describe('parseHighlightedEmployeeId', () => {
    it('parses a positive integer query param', () => {
        expect(parseHighlightedEmployeeId('42')).toBe(42)
    })

    it('returns null when the param is absent', () => {
        expect(parseHighlightedEmployeeId(null)).toBeNull()
    })

    it.each(['', '0', '-3', '1.5', 'abc'])('rejects garbage input %s', (raw) => {
        expect(parseHighlightedEmployeeId(raw)).toBeNull()
    })
})
