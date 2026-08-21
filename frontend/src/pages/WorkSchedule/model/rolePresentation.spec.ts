import { describe, expect, it } from 'vitest'

import {
    NOT_WORKING_ROLE_STYLE,
    ROLE_LEGEND_ORDER,
    ROLE_STYLE,
    resolveRoleCellStyle,
    roleCellLabel,
    roleCellStyle,
} from './rolePresentation.ts'

describe('roleCellLabel', () => {
    it('shows the role glyph for a working day with a legend role', () => {
        expect(roleCellLabel({ status: 'WORKING', role: 'ENGINEER' })).toBe('И')
        expect(roleCellLabel({ status: 'WORKING', role: 'ONLINE_MANAGER' })).toBe('ОН')
        expect(roleCellLabel({ status: 'WORKING', role: 'OFFLINE_MANAGER' })).toBe('ОФ')
        expect(roleCellLabel({ status: 'WORKING', role: 'OFFICE' })).toBe('ОС')
    })

    it('shows a dash for a working day without a role yet', () => {
        expect(roleCellLabel({ status: 'WORKING', role: null })).toBe('—')
    })

    it('shows a dash for a working day with a role outside the four the tab covers', () => {
        expect(roleCellLabel({ status: 'WORKING', role: 'ORDER_MANAGER' })).toBe('—')
    })

    it('shows a dash for every non-WORKING status, including an unfilled day', () => {
        expect(roleCellLabel({ status: 'DAY_OFF', role: null })).toBe('—')
        expect(roleCellLabel({ status: 'TIME_OFF', role: null })).toBe('—')
        expect(roleCellLabel({ status: 'SICK_LEAVE', role: null })).toBe('—')
        expect(roleCellLabel({ status: 'VACATION', role: null })).toBe('—')
        expect(roleCellLabel({ status: null, role: null })).toBe('—')
    })
})

describe('roleCellStyle', () => {
    it('gives each of the four legend roles a distinct color', () => {
        const styles = ROLE_LEGEND_ORDER.map(
            (role) => roleCellStyle({ status: 'WORKING', role }).textClassName,
        )
        expect(new Set(styles).size).toBe(ROLE_LEGEND_ORDER.length)
    })

    it('renders an unfilled/non-working day with the "не рабочий день" style', () => {
        expect(roleCellStyle({ status: null, role: null })).toEqual({
            bgClassName: NOT_WORKING_ROLE_STYLE.bgClassName,
            textClassName: NOT_WORKING_ROLE_STYLE.textClassName,
        })
    })

    it('renders a working day without a role differently from a non-working day', () => {
        const unassigned = roleCellStyle({ status: 'WORKING', role: null })
        expect(unassigned.bgClassName).not.toBe(NOT_WORKING_ROLE_STYLE.bgClassName)
    })
})

describe('resolveRoleCellStyle', () => {
    it('matches ROLE_STYLE exactly for each legend role', () => {
        for (const role of ROLE_LEGEND_ORDER) {
            expect(resolveRoleCellStyle({ status: 'WORKING', role })).toEqual(ROLE_STYLE[role])
        }
    })
})
