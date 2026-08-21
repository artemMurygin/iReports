import { describe, expect, it } from 'vitest'

import { cellLabel, cellStyle, formatHours, resolveCellVariant } from './cellPresentation.ts'

describe('resolveCellVariant', () => {
    it('maps status: null to EMPTY', () => {
        expect(resolveCellVariant({ status: null })).toBe('EMPTY')
    })

    it('passes a real status through unchanged', () => {
        expect(resolveCellVariant({ status: 'WORKING' })).toBe('WORKING')
        expect(resolveCellVariant({ status: 'VACATION' })).toBe('VACATION')
    })
})

describe('formatHours', () => {
    it('renders whole hours without a decimal part', () => {
        expect(formatHours(8)).toBe('8')
        expect(formatHours(12)).toBe('12')
    })

    it('renders half hours with a Russian decimal comma', () => {
        expect(formatHours(7.5)).toBe('7,5')
    })
})

describe('cellLabel', () => {
    it('shows hours for a WORKING day with hours set', () => {
        expect(cellLabel({ status: 'WORKING', hours: 8 }, 'WORKING')).toBe('8')
        expect(cellLabel({ status: 'WORKING', hours: 7.5 }, 'WORKING')).toBe('7,5')
    })

    it('shows a dash for a WORKING day without hours yet', () => {
        expect(cellLabel({ status: 'WORKING', hours: null }, 'WORKING')).toBe('—')
    })

    it('shows a dash for an unfilled day', () => {
        expect(cellLabel({ status: null, hours: null }, 'EMPTY')).toBe('—')
    })

    it('shows the status glyph for absence statuses', () => {
        expect(cellLabel({ status: 'DAY_OFF', hours: null }, 'DAY_OFF')).toBe('—')
        expect(cellLabel({ status: 'TIME_OFF', hours: null }, 'TIME_OFF')).toBe('О')
        expect(cellLabel({ status: 'SICK_LEAVE', hours: null }, 'SICK_LEAVE')).toBe('Б')
        expect(cellLabel({ status: 'VACATION', hours: null }, 'VACATION')).toBe('От')
    })
})

describe('cellStyle', () => {
    it('renders EMPTY with the same style as DAY_OFF', () => {
        expect(cellStyle('EMPTY')).toEqual(cellStyle('DAY_OFF'))
    })

    it('gives each absence status a distinct color', () => {
        const variants = ['WORKING', 'DAY_OFF', 'TIME_OFF', 'SICK_LEAVE', 'VACATION'] as const
        const styles = variants.map((variant) => cellStyle(variant).textClassName)
        expect(new Set(styles).size).toBe(variants.length)
    })
})
