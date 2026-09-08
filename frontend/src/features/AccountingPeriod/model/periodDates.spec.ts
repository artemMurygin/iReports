import { describe, expect, it } from 'vitest'

import { isPeriodExpired } from './periodDates.ts'

// «Истёкший месяц» считается в UTC — как Period.getBounds() на бэкенде (см. заметку
// Фазы 2 docs/payroll-closing-and-accrual): первое число следующего месяца 00:00 UTC
// (03:00 МСК). Граничные тесты фиксируют именно UTC-поведение, чтобы дизейбл кнопки
// «Закрыть месяц» не разошёлся с ответом бэкенда в ночь на первое число.
describe('isPeriodExpired', () => {
    it('прошедший месяц истёк', () => {
        expect(isPeriodExpired('2026-06', new Date('2026-08-21T12:00:00Z'))).toBe(true)
    })

    it('текущий месяц не истёк', () => {
        expect(isPeriodExpired('2026-08', new Date('2026-08-21T12:00:00Z'))).toBe(false)
    })

    it('будущий месяц не истёк', () => {
        expect(isPeriodExpired('2026-09', new Date('2026-08-21T12:00:00Z'))).toBe(false)
    })

    it('месяц истекает ровно в 00:00 UTC первого числа следующего месяца', () => {
        expect(isPeriodExpired('2026-07', new Date('2026-07-31T23:59:59.999Z'))).toBe(false)
        expect(isPeriodExpired('2026-07', new Date('2026-08-01T00:00:00Z'))).toBe(true)
    })

    it('декабрь переходит через границу года', () => {
        expect(isPeriodExpired('2025-12', new Date('2026-01-01T00:00:00Z'))).toBe(true)
        expect(isPeriodExpired('2025-12', new Date('2025-12-31T23:00:00Z'))).toBe(false)
    })

    it('невалидный период не считается истёкшим', () => {
        expect(isPeriodExpired('not-a-period', new Date('2026-08-21T12:00:00Z'))).toBe(false)
    })
})
