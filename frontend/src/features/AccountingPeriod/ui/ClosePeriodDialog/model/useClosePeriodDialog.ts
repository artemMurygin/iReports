import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SalesDirection } from 'ireports-contracts'

import { api } from '../../../model/api.ts'
import { classifyClosePeriodError } from '../../../model/closePeriodErrors.ts'
import { useClosePeriod } from '../../../model/usePeriodMutations.ts'
import { deriveCloseDialogState, type CloseDialogState } from './dialogState.ts'

export type UseClosePeriodDialogArgs = {
    open: boolean
    direction: SalesDirection
    period: string
    /** Вызывается после успешного закрытия (страница закрывает диалог и уходит на список начислений). */
    onClosed: () => void
}

/**
 * Весь стейт диалога закрытия: сводка close-preview (грузится только пока диалог
 * открыт), мутация закрытия и производное состояние `deriveCloseDialogState`.
 * Плоский объект на возврате — конвенция model-хуков (frontend/CLAUDE.md).
 */
export function useClosePeriodDialog({ open, direction, period, onClosed }: UseClosePeriodDialogArgs) {
    const previewQuery = useQuery({
        ...api.getClosePreview(direction, period),
        enabled: open,
    })
    const closeMutation = useClosePeriod(direction, period)
    const { reset } = closeMutation

    // Каждое новое открытие диалога начинается «с чистого листа»: ошибка прошлой
    // попытки закрытия (например, ERP-таймаут) не должна встречать пользователя снова.
    useEffect(() => {
        if (open) reset()
    }, [open, reset])

    const closeError = closeMutation.error !== null ? classifyClosePeriodError(closeMutation.error) : null

    const state: CloseDialogState = deriveCloseDialogState({
        preview: previewQuery.data,
        isPreviewLoading: previewQuery.isPending,
        previewError: previewQuery.error !== null ? previewQuery.error.message : null,
        closeError,
        isClosing: closeMutation.isPending,
    })

    function submit() {
        closeMutation.mutate(undefined, { onSuccess: onClosed })
    }

    return {
        preview: previewQuery.data,
        state,
        submit,
        retryPreview: () => void previewQuery.refetch(),
    }
}
