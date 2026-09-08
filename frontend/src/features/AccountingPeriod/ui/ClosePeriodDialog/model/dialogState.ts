import type { ClosePeriodPreviewResponse, UnapprovedSalesPlanRow } from 'ireports-contracts'

import type { ClosePeriodError } from '../../../model/closePeriodErrors.ts'

/**
 * Чистая производная состояния диалога закрытия месяца (Pencil: `GUo20` готово /
 * `KPPJ5` заблокировано планом / `hhWeF` ошибка ERP / `xL1JD` выполняется).
 * Вынесена из компонента, чтобы её можно было тестировать vitest'ом без DOM
 * (тот же приём, что model-тесты pages/WorkSchedule): компонент только рисует
 * то, что здесь решено.
 */

export type CloseDialogStatus =
    /** Сводка close-preview ещё грузится — скелетон вместо KPI. */
    | 'loading'
    /** Сводку загрузить не удалось — закрытие без контрольных цифр не предлагаем. */
    | 'preview-error'
    /** Проверки пройдены, кнопка «Закрыть месяц» активна (зелёный alert). */
    | 'ready'
    /** Есть неутверждённые строки плана — кнопка заблокирована (жёлтый alert + перечень). */
    | 'blocked'
    /** Мутация закрытия выполняется: синк ERP + снапшот (синий alert, спиннер на кнопке). */
    | 'closing'
    /** Закрытие отклонено ошибкой синка ERP / недоступностью бэкенда — красный alert с «Повторить». */
    | 'erp-error'
    /** Прочие ошибки закрытия (месяц не истёк, уже закрыт, неизвестное) — красный alert без «Повторить». */
    | 'error'

export type CloseDialogState = {
    status: CloseDialogStatus
    /** Строки, блокирующие закрытие: из close-preview или из 409 самого закрытия. */
    unapprovedRows: UnapprovedSalesPlanRow[]
    /** Кнопка «Закрыть месяц» активна только когда проверки пройдены. */
    canSubmit: boolean
    /** metadata.reason ошибки ERP-синка — вторая строка красного alert'а. */
    erpReason: string | null
    /** Текст для статуса 'error' / 'preview-error'. */
    errorMessage: string | null
}

export function deriveCloseDialogState(input: {
    preview: ClosePeriodPreviewResponse | undefined
    isPreviewLoading: boolean
    previewError: string | null
    closeError: ClosePeriodError | null
    isClosing: boolean
}): CloseDialogState {
    const { preview, isPreviewLoading, previewError, closeError, isClosing } = input

    // 409 закрытия с metadata.rows свежее, чем сводка: закрытие могли попытаться сделать
    // после того, как кто-то параллельно вернул строку в черновик.
    const unapprovedRows =
        closeError?.kind === 'unapproved-plan' ? closeError.rows : (preview?.unapprovedPlanRows ?? [])

    const base = { unapprovedRows, canSubmit: false, erpReason: null, errorMessage: null }

    if (isClosing) return { ...base, status: 'closing' }

    if (preview === undefined) {
        if (isPreviewLoading) return { ...base, status: 'loading' }
        return { ...base, status: 'preview-error', errorMessage: previewError }
    }

    if (closeError?.kind === 'erp-sync') {
        return { ...base, status: 'erp-error', erpReason: closeError.reason }
    }

    if (unapprovedRows.length > 0) return { ...base, status: 'blocked' }

    if (closeError !== null && closeError.kind !== 'unapproved-plan') {
        return { ...base, status: 'error', errorMessage: closeError.message }
    }

    return { ...base, status: 'ready', canSubmit: true }
}
