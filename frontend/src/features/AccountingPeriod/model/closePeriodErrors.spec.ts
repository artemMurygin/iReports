import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { classifyClosePeriodError, classifyReopenPeriodError } from './closePeriodErrors.ts'

// Бэкенд отдаёт все конфликты закрытия одним статусом 409/CONFLICT
// (ErpSyncFailedException / PeriodNotExpiredException / AccountingPeriodClosedException /
// UnapprovedSalesPlanRowsException), различимы они только по `metadata` и тексту
// `message` — эти тесты фиксируют разбор для каждого варианта плюс 503/сетевую ошибку
// («состояния ошибки синка (409/503)» из задач Фазы 4).
function axiosError(status: number | null, data?: unknown): AxiosError {
    const error = new AxiosError(`Request failed with status code ${status ?? 'network'}`)
    if (status !== null) {
        error.response = { status, data } as AxiosResponse
    }
    return error
}

describe('classifyClosePeriodError', () => {
    it('409 с metadata.rows -> unapproved-plan с перечнем строк', () => {
        const rows = [{ id: 'p1', department: 160, category: 'Ремонт Apple' }]
        const result = classifyClosePeriodError(
            axiosError(409, { message: 'Нельзя закрыть период — есть неутверждённые строки', metadata: { rows } }),
        )
        expect(result).toEqual({ kind: 'unapproved-plan', rows })
    })

    it('409 ошибки ERP-синка -> erp-error с reason из metadata', () => {
        const result = classifyClosePeriodError(
            axiosError(409, {
                message: 'Не удалось получить данные из ERP, повторите позже',
                metadata: { direction: 'service', period: '2026-07', reason: 'timeout of 120000ms exceeded' },
            }),
        )
        expect(result).toEqual({
            kind: 'erp-sync',
            message: 'Не удалось получить данные из ERP, повторите позже',
            reason: 'timeout of 120000ms exceeded',
        })
    })

    it('503 (бэкенд/шлюз недоступен) -> erp-error без reason', () => {
        const result = classifyClosePeriodError(axiosError(503, { message: 'Service Unavailable' }))
        expect(result.kind).toBe('erp-sync')
    })

    it('сетевая ошибка без ответа -> erp-error (можно повторить)', () => {
        const result = classifyClosePeriodError(axiosError(null))
        expect(result.kind).toBe('erp-sync')
    })

    it('409 «месяц ещё не закончился» -> not-expired', () => {
        const result = classifyClosePeriodError(
            axiosError(409, {
                message: 'Нельзя закрыть период 2026-08 направления "service" — месяц ещё не закончился',
                metadata: { direction: 'service', period: '2026-08' },
            }),
        )
        expect(result.kind).toBe('not-expired')
    })

    it('409 уже закрытого периода -> already-closed с closedBy/closedAt', () => {
        const result = classifyClosePeriodError(
            axiosError(409, {
                message: 'Период 2026-07 направления "service" закрыт — изменение данных за этот месяц недоступно',
                metadata: { direction: 'service', period: '2026-07', closedBy: 7, closedAt: '2026-08-01T11:20:00.000Z' },
            }),
        )
        expect(result).toEqual({
            kind: 'already-closed',
            message: 'Период 2026-07 направления "service" закрыт — изменение данных за этот месяц недоступно',
            closedBy: 7,
            closedAt: '2026-08-01T11:20:00.000Z',
        })
    })

    it('не-axios ошибка -> unknown с текстом', () => {
        const result = classifyClosePeriodError(new Error('boom'))
        expect(result.kind).toBe('unknown')
    })
})

describe('classifyReopenPeriodError', () => {
    it('409 с metadata.accruals -> not-draft с перечнем документов', () => {
        const accruals = [{ id: 'a1', employeeId: 42, status: 'ACCRUED' }]
        const result = classifyReopenPeriodError(
            axiosError(409, { message: 'Нельзя переоткрыть период', metadata: { accruals } }),
        )
        expect(result).toEqual({ kind: 'not-draft', accruals })
    })

    it('прочее -> unknown с сообщением сервера', () => {
        const result = classifyReopenPeriodError(axiosError(500, { message: 'Внутренняя ошибка' }))
        expect(result).toEqual({ kind: 'unknown', message: 'Внутренняя ошибка' })
    })
})
