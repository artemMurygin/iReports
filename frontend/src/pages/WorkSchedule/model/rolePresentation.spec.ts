import { describe, expect, it } from 'vitest'

import {
    isRoleEditableCell,
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
        expect(roleCellLabel({ status: 'WORKING', role: 'ONLINE_MANAGER' })).toBe('Онл')
        expect(roleCellLabel({ status: 'WORKING', role: 'OFFLINE_MANAGER' })).toBe('Офл')
        expect(roleCellLabel({ status: 'WORKING', role: 'OFFICE' })).toBe('ОФ')
        expect(roleCellLabel({ status: 'WORKING', role: 'SOLO_MANAGER' })).toBe('СМ')
    })

    it('shows a dash for a working day without a role yet', () => {
        expect(roleCellLabel({ status: 'WORKING', role: null })).toBe('—')
    })

    it('shows a dash for a working day with a role outside the ones the tab covers', () => {
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
    it('gives each legend role a distinct color', () => {
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

describe('ROLE_STYLE.selectedBorderClassName', () => {
    it('gives each legend role a distinct selected-pill border, like STATUS_STYLE', () => {
        const borders = ROLE_LEGEND_ORDER.map((role) => ROLE_STYLE[role].selectedBorderClassName)
        expect(new Set(borders).size).toBe(ROLE_LEGEND_ORDER.length)
    })
})

describe('isRoleEditableCell', () => {
    it('allows editing a working day, with or without a role assigned yet', () => {
        expect(isRoleEditableCell({ status: 'WORKING' })).toBe(true)
    })

    it('blocks editing every non-working/unfilled day (плана Фаза 8: "роль не редактируется")', () => {
        expect(isRoleEditableCell({ status: 'DAY_OFF' })).toBe(false)
        expect(isRoleEditableCell({ status: 'TIME_OFF' })).toBe(false)
        expect(isRoleEditableCell({ status: 'SICK_LEAVE' })).toBe(false)
        expect(isRoleEditableCell({ status: 'VACATION' })).toBe(false)
        expect(isRoleEditableCell({ status: null })).toBe(false)
    })
})
