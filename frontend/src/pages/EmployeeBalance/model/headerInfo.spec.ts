import { describe, expect, it } from 'vitest'

import { buildHeaderSubtitle } from './headerInfo.ts'

describe('buildHeaderSubtitle', () => {
    it('joins non-empty parts with " · "', () => {
        expect(buildHeaderSubtitle(['Отдел сервиса', 'Инженер'])).toBe('Отдел сервиса · Инженер')
    })

    it('skips null/undefined/blank parts', () => {
        expect(buildHeaderSubtitle(['Отдел сервиса', null, '  ', undefined])).toBe('Отдел сервиса')
    })

    it('returns null when every part is empty', () => {
        expect(buildHeaderSubtitle([null, undefined, ''])).toBeNull()
    })
})
