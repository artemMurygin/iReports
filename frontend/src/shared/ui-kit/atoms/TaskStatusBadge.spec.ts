import { describe, expect, it } from 'vitest'

import { getTaskStatusBadgeVariant } from './TaskStatusBadge.tsx'

// replace-bitrix-task-integration, tasks.md группа 10.1: маппинг TaskStatusCode -> {label,
// className} на все 6 статусов жизненного цикла задачи (specs/tasks/spec.md «Жизненный цикл
// статуса задачи»), расцветки по ui-design.md/`iZrrX` (см. execute-снимок узла в .pen — badge
// instances `dLETE`/`ng528`/`C5tR7x`/`FvAr9`/`T80Uy`/`lXemm`):
// NEW -> canvas/ink-muted (нейтральный), IN_PROGRESS -> info-soft/info-ink, DONE -> warn-soft/
// warn-ink, CLOSED_SUCCESSFULLY -> brand-soft/ok-ink (success), CLOSED_UNSUCCESSFULLY ->
// danger-soft/danger, REWORK -> violet-soft/violet-ink.
describe('getTaskStatusBadgeVariant', () => {
    it('maps NEW to the neutral (canvas/ink-muted) variant with the Russian label «Новая»', () => {
        expect(getTaskStatusBadgeVariant('NEW')).toEqual({
            label: 'Новая',
            className: 'bg-canvas text-ink-muted',
        })
    })

    it('maps IN_PROGRESS to the info variant with the Russian label «В работе»', () => {
        expect(getTaskStatusBadgeVariant('IN_PROGRESS')).toEqual({
            label: 'В работе',
            className: 'bg-info-soft text-info-ink',
        })
    })

    it('maps DONE to the warning variant with the Russian label «Выполнена»', () => {
        expect(getTaskStatusBadgeVariant('DONE')).toEqual({
            label: 'Выполнена',
            className: 'bg-warn-soft text-warn-ink',
        })
    })

    it('maps CLOSED_SUCCESSFULLY to the success variant with the Russian label «Закрыта успешно»', () => {
        expect(getTaskStatusBadgeVariant('CLOSED_SUCCESSFULLY')).toEqual({
            label: 'Закрыта успешно',
            className: 'bg-brand-soft text-ok-ink',
        })
    })

    it('maps CLOSED_UNSUCCESSFULLY to the danger variant with the Russian label «Закрыто неуспешно»', () => {
        expect(getTaskStatusBadgeVariant('CLOSED_UNSUCCESSFULLY')).toEqual({
            label: 'Закрыто неуспешно',
            className: 'bg-danger-soft text-danger',
        })
    })

    it('maps REWORK to the violet variant with the Russian label «На доработку»', () => {
        expect(getTaskStatusBadgeVariant('REWORK')).toEqual({
            label: 'На доработку',
            className: 'bg-violet-soft text-violet-ink',
        })
    })

    it('covers all 6 TaskStatus lifecycle values with a distinct className each', () => {
        const statuses = [
            'NEW',
            'IN_PROGRESS',
            'DONE',
            'CLOSED_SUCCESSFULLY',
            'CLOSED_UNSUCCESSFULLY',
            'REWORK',
        ] as const

        const classNames = statuses.map((status) => getTaskStatusBadgeVariant(status).className)

        expect(new Set(classNames).size).toBe(statuses.length)
    })
})
