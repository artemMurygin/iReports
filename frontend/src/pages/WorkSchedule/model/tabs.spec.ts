import { describe, expect, it } from 'vitest'

import { WORK_SCHEDULE_TAB_OPTIONS } from './tabs.ts'

describe('WORK_SCHEDULE_TAB_OPTIONS', () => {
    it('offers exactly the two tabs the design shows, in design order', () => {
        expect(WORK_SCHEDULE_TAB_OPTIONS.map((option) => option.value)).toEqual(['CALENDAR', 'ROLES'])
    })

    it('labels each tab with the design’s Russian caption', () => {
        expect(WORK_SCHEDULE_TAB_OPTIONS.map((option) => option.label)).toEqual(['Календарь', 'Роли'])
    })
})
