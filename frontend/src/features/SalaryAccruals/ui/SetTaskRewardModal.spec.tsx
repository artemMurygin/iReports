import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SalaryAccrualLine } from 'ireports-contracts'

import { SetTaskRewardModal } from './SetTaskRewardModal.tsx'

/**
 * add-task-based-salary-rule, раздел 24 tasks.md (24.5-24.7); design.md Decision 5 —
 * ручной ввод суммы+комментария строки «за выполнение задачи», без Pencil-фрейма (см.
 * инструкция в начале tasks.md): собран из готовых атомов по прецеденту
 * `AdjustLineModal.tsx`, но без поля «Исходная сумма» (originalAmount всегда 0 для этого
 * типа строк). Мутация мокается — тест проверяет только собственную логику модалки
 * (валидация/вызов мутации/закрытие по успеху), сама мутация уже покрыта
 * `useAccrualMutations.spec.tsx`.
 */
const mutateMock = vi.fn()
const mockMutation = {
    mutate: mutateMock,
    isPending: false,
    error: null as unknown,
    reset: vi.fn(),
}

vi.mock('../model/useAccrualMutations.ts', () => ({
    useSetTaskCompletionLineReward: vi.fn(() => mockMutation),
}))

const LINE: SalaryAccrualLine = {
    id: 'line-1',
    ruleId: 'rule-1',
    type: 'TaskCompletion',
    name: 'Обновить документацию склада',
    targetRole: 'OFFICE',
    salaryBasis: undefined,
    quantity: undefined,
    rate: undefined,
    amount: 0,
    originalAmount: 0,
    sources: [],
    status: 'DRAFT',
    adjustmentComment: null,
    comment: null,
    requiresManualInput: true,
}

describe('SetTaskRewardModal', () => {
    beforeEach(() => {
        mutateMock.mockReset()
        mockMutation.isPending = false
        mockMutation.error = null
    })

    it('не рендерится, когда open=false', () => {
        render(<SetTaskRewardModal open={false} onOpenChange={vi.fn()} line={LINE} direction="service" accrualId="acc-1" />)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('не показывает поле «Исходная сумма» (design.md Decision 5)', () => {
        render(<SetTaskRewardModal open onOpenChange={vi.fn()} line={LINE} direction="service" accrualId="acc-1" />)
        expect(screen.queryByText('Исходная сумма')).not.toBeInTheDocument()
    })

    it('показывает ошибку валидации и не вызывает мутацию, когда комментарий пустой', () => {
        render(<SetTaskRewardModal open onOpenChange={vi.fn()} line={LINE} direction="service" accrualId="acc-1" />)

        fireEvent.change(screen.getByLabelText('Сумма'), { target: { value: '5000' } })
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

        expect(screen.getByText('Комментарий обязателен')).toBeInTheDocument()
        expect(mutateMock).not.toHaveBeenCalled()
    })

    it('вызывает useSetTaskCompletionLineReward при сохранении и закрывается по успеху', () => {
        const onOpenChange = vi.fn()
        mutateMock.mockImplementation((_payload, options?: { onSuccess?: () => void }) => {
            options?.onSuccess?.()
        })
        render(<SetTaskRewardModal open onOpenChange={onOpenChange} line={LINE} direction="service" accrualId="acc-1" />)

        fireEvent.change(screen.getByLabelText('Сумма'), { target: { value: '5000' } })
        fireEvent.change(screen.getByLabelText('Комментарий'), { target: { value: 'Задача выполнена в срок' } })
        fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

        expect(mutateMock).toHaveBeenCalledWith(
            { lineId: 'line-1', amount: 5000, comment: 'Задача выполнена в срок' },
            expect.objectContaining({ onSuccess: expect.any(Function) }),
        )
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })
})
