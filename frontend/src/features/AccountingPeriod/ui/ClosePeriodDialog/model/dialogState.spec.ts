import type { ClosePeriodPreviewResponse } from 'ireports-contracts'
import { describe, expect, it } from 'vitest'

import { deriveCloseDialogState } from './dialogState.ts'

// Компонентные тесты трёх состояний диалога закрытия из плана Фазы 4 (готово /
// заблокировано планом / ошибка ERP — Pencil `GUo20`/`KPPJ5`/`hhWeF`) + состояние
// выполнения `xL1JD`. Тестируется чистая производная состояния (model), а не DOM:
// в проекте нет jsdom/testing-library, все компонентные проверки живут на уровне
// model-функций (см. pages/WorkSchedule/model/*.spec.ts — тот же приём).

const PREVIEW_READY: ClosePeriodPreviewResponse = {
    direction: 'service',
    period: '2026-07',
    employeesCount: 48,
    dismissedEmployeesCount: 2,
    totalAmount: 3_214_800,
    unapprovedPlanRows: [],
    employeesWithoutHours: 3,
    unclosedTaskRules: [],
}

const UNAPPROVED_ROW = { id: 'p1', department: 160, category: 'Ремонт Apple' }

const IDLE = {
    isPreviewLoading: false,
    previewError: null,
    closeError: null,
    isClosing: false,
}

describe('deriveCloseDialogState', () => {
    it('готово к закрытию: все строки утверждены -> ready, кнопка активна', () => {
        const state = deriveCloseDialogState({ ...IDLE, preview: PREVIEW_READY })
        expect(state.status).toBe('ready')
        expect(state.canSubmit).toBe(true)
        expect(state.unapprovedRows).toEqual([])
    })

    it('заблокировано планом: есть неутверждённые строки -> blocked, кнопка неактивна', () => {
        const state = deriveCloseDialogState({
            ...IDLE,
            preview: { ...PREVIEW_READY, unapprovedPlanRows: [UNAPPROVED_ROW] },
        })
        expect(state.status).toBe('blocked')
        expect(state.canSubmit).toBe(false)
        expect(state.unapprovedRows).toEqual([UNAPPROVED_ROW])
    })

    it('ошибка ERP-синка -> erp-error с reason, кнопка неактивна (повтор — из alert)', () => {
        const state = deriveCloseDialogState({
            ...IDLE,
            preview: PREVIEW_READY,
            closeError: { kind: 'erp-sync', message: 'Не удалось получить данные из ERP', reason: 'timeout' },
        })
        expect(state.status).toBe('erp-error')
        expect(state.erpReason).toBe('timeout')
        expect(state.canSubmit).toBe(false)
    })

    it('ошибка ERP приоритетнее перечня строк (hhWeF: alert вместо списка)', () => {
        const state = deriveCloseDialogState({
            ...IDLE,
            preview: { ...PREVIEW_READY, unapprovedPlanRows: [UNAPPROVED_ROW] },
            closeError: { kind: 'erp-sync', message: 'Не удалось получить данные из ERP', reason: null },
        })
        expect(state.status).toBe('erp-error')
    })

    it('выполняется закрытие -> closing независимо от прочего', () => {
        const state = deriveCloseDialogState({ ...IDLE, preview: PREVIEW_READY, isClosing: true })
        expect(state.status).toBe('closing')
        expect(state.canSubmit).toBe(false)
    })

    it('409 самого закрытия с перечнем строк перекрывает пустую сводку', () => {
        const state = deriveCloseDialogState({
            ...IDLE,
            preview: PREVIEW_READY,
            closeError: { kind: 'unapproved-plan', rows: [UNAPPROVED_ROW] },
        })
        expect(state.status).toBe('blocked')
        expect(state.unapprovedRows).toEqual([UNAPPROVED_ROW])
    })

    it('сводка ещё грузится -> loading', () => {
        const state = deriveCloseDialogState({ ...IDLE, preview: undefined, isPreviewLoading: true })
        expect(state.status).toBe('loading')
    })

    it('сводку загрузить не удалось -> preview-error с сообщением', () => {
        const state = deriveCloseDialogState({
            ...IDLE,
            preview: undefined,
            previewError: 'Не удалось загрузить сводку закрытия месяца',
        })
        expect(state.status).toBe('preview-error')
        expect(state.errorMessage).toBe('Не удалось загрузить сводку закрытия месяца')
    })

    it('прочая ошибка закрытия (месяц не истёк) -> error с текстом сервера', () => {
        const state = deriveCloseDialogState({
            ...IDLE,
            preview: PREVIEW_READY,
            closeError: { kind: 'not-expired', message: 'месяц ещё не закончился' },
        })
        expect(state.status).toBe('error')
        expect(state.errorMessage).toBe('месяц ещё не закончился')
    })
})
