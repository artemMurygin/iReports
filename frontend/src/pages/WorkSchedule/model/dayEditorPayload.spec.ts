import { describe, expect, it } from 'vitest'

import {
    buildUpsertPayload,
    clampHours,
    DEFAULT_SHIFT_HOURS,
    resolveDutyForStatus,
    resolveHoursForStatus,
} from './dayEditorPayload.ts'

describe('clampHours', () => {
    it('passes a value already on the 0.5 grid through unchanged', () => {
        expect(clampHours(7.5)).toBe(7.5)
        expect(clampHours(8)).toBe(8)
    })

    it('rounds to the nearest 0.5 step', () => {
        expect(clampHours(7.3)).toBe(7.5)
        expect(clampHours(7.2)).toBe(7)
    })

    it('clamps below the minimum up to 2', () => {
        expect(clampHours(0)).toBe(2)
        expect(clampHours(-5)).toBe(2)
    })

    it('clamps above the maximum down to 16', () => {
        expect(clampHours(20)).toBe(16)
    })
})

describe('resolveHoursForStatus', () => {
    it('drops hours for every non-WORKING status', () => {
        expect(resolveHoursForStatus('DAY_OFF', 8)).toBeNull()
        expect(resolveHoursForStatus('TIME_OFF', 8)).toBeNull()
        expect(resolveHoursForStatus('SICK_LEAVE', 8)).toBeNull()
        expect(resolveHoursForStatus('VACATION', 8)).toBeNull()
    })

    it('keeps already-set hours when switching to WORKING', () => {
        expect(resolveHoursForStatus('WORKING', 10)).toBe(10)
    })

    it('defaults an unset shift to DEFAULT_SHIFT_HOURS when switching to WORKING', () => {
        expect(resolveHoursForStatus('WORKING', null)).toBe(DEFAULT_SHIFT_HOURS)
    })
})

describe('resolveDutyForStatus', () => {
    it('drops the duty mark for every non-WORKING status', () => {
        expect(resolveDutyForStatus('DAY_OFF', true)).toBe(false)
        expect(resolveDutyForStatus('TIME_OFF', true)).toBe(false)
        expect(resolveDutyForStatus('SICK_LEAVE', true)).toBe(false)
        expect(resolveDutyForStatus('VACATION', true)).toBe(false)
    })

    it('keeps the already-set duty mark when switching to WORKING', () => {
        expect(resolveDutyForStatus('WORKING', true)).toBe(true)
        expect(resolveDutyForStatus('WORKING', false)).toBe(false)
    })
})

describe('buildUpsertPayload', () => {
    it('sends status only for non-WORKING statuses, ignoring any passed hours/role/isOnDuty', () => {
        expect(buildUpsertPayload(7, '2026-08-20', 'VACATION', 8, 'ENGINEER', true)).toEqual({
            employeeId: 7,
            date: '2026-08-20',
            status: 'VACATION',
        })
    })

    it('includes hours, role and isOnDuty for a WORKING day when all are known', () => {
        expect(buildUpsertPayload(7, '2026-08-20', 'WORKING', 8, 'ENGINEER', true)).toEqual({
            employeeId: 7,
            date: '2026-08-20',
            status: 'WORKING',
            hours: 8,
            role: 'ENGINEER',
            isOnDuty: true,
        })
    })

    it('omits hours/role for a WORKING day when they are not known yet, but always sends isOnDuty', () => {
        expect(buildUpsertPayload(7, '2026-08-20', 'WORKING', null, null, false)).toEqual({
            employeeId: 7,
            date: '2026-08-20',
            status: 'WORKING',
            isOnDuty: false,
        })
    })

    // Критерий готовности Фазы 7: «статус «Отпуск» увеличивает счётчик использованных дней
    // отпуска» — на фронте это ровно то, что PUT-запрос для VACATION действительно уходит с этим
    // статусом (счётчик считает и возвращает бэкенд после инвалидации месяца, см.
    // `useSaveWorkScheduleEntry.ts`).
    it('requests VACATION status as-is, the trigger for the vacation-used counter to grow', () => {
        const payload = buildUpsertPayload(7, '2026-08-20', 'VACATION', null, null, false)
        expect(payload.status).toBe('VACATION')
    })

    // Критерий готовности Фазы 8b («Роли»): назначение роли из вкладки «Роли» переиспользует
    // `buildUpsertPayload` (`useRolePicker.ts`) со статусом, часами и дежурством дня как есть —
    // меняется только `role`. Один и тот же билдер, что и у поповера «Календаря» (Фаза 7),
    // гарантирует, что оба поповера собирают тело запроса одинаково.
    it('changes only the role when the day already has a status, hours and duty mark (role tab reassignment)', () => {
        expect(buildUpsertPayload(7, '2026-08-20', 'WORKING', 6, 'OFFICE', true)).toEqual({
            employeeId: 7,
            date: '2026-08-20',
            status: 'WORKING',
            hours: 6,
            role: 'OFFICE',
            isOnDuty: true,
        })
    })

    // Отметка «дежурный» ставится/снимается через тот же билдер (переключатель в
    // `DayEditorPopover`, `docs/work-schedule-duty-mark`) — явное `false` должно уйти на сервер,
    // а не потеряться так же, как отсутствующие hours/role.
    it('sends isOnDuty: false explicitly to clear a previously-set duty mark', () => {
        expect(buildUpsertPayload(7, '2026-08-20', 'WORKING', 8, null, false)).toEqual({
            employeeId: 7,
            date: '2026-08-20',
            status: 'WORKING',
            hours: 8,
            isOnDuty: false,
        })
    })
})
