import { describe, expect, it } from 'vitest'

import { resolveAbsenceReasonStyle } from './absenceReasonPresentation.ts'

describe('resolveAbsenceReasonStyle', () => {
    it('resolves each of the four legend reasons to its own colour', () => {
        expect(resolveAbsenceReasonStyle('DAY_OFF')).toEqual({
            label: 'Выходной',
            bgClassName: 'bg-canvas',
            textClassName: 'text-ink-muted',
        })
        expect(resolveAbsenceReasonStyle('VACATION')).toEqual({
            label: 'Отпуск',
            bgClassName: 'bg-info-soft',
            textClassName: 'text-info-ink',
        })
        expect(resolveAbsenceReasonStyle('SICK_LEAVE')).toEqual({
            label: 'Больничный',
            bgClassName: 'bg-danger-soft',
            textClassName: 'text-danger',
        })
        expect(resolveAbsenceReasonStyle('TIME_OFF')).toEqual({
            label: 'Отгул',
            bgClassName: 'bg-warn-soft',
            textClassName: 'text-warn-ink',
        })
    })

    it('resolves NOT_FILLED (no schedule entry at all) to a neutral style distinct from DAY_OFF', () => {
        const style = resolveAbsenceReasonStyle('NOT_FILLED')
        expect(style.label).toBe('Не заполнен')
        expect(style.textClassName).not.toBe(resolveAbsenceReasonStyle('DAY_OFF').textClassName)
    })
})
