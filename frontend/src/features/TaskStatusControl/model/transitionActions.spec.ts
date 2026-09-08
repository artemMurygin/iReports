import { describe, expect, it } from 'vitest'
import type { TaskStatus } from 'ireports-contracts'

import { getTransitionActions, getTransitionHint } from './transitionActions.ts'

// replace-bitrix-task-integration, tasks.md 12.1 — specs/tasks/spec.md «Жизненный цикл статуса
// задачи»: из NEW/IN_PROGRESS ровно один шаг вперёд по цепочке ответственного, из DONE — три
// действия проверки руководителя, из REWORK — «вернуть в работу», из CLOSED_* — ни одной кнопки.
describe('getTransitionActions', () => {
    it('NEW -> один переход "Взять в работу" (в IN_PROGRESS)', () => {
        const actions = getTransitionActions('NEW')
        expect(actions).toEqual([{ targetStatus: 'IN_PROGRESS', label: 'Взять в работу', icon: 'play', tone: 'brand' }])
    })

    it('IN_PROGRESS -> один переход "Отметить выполненной" (в DONE)', () => {
        const actions = getTransitionActions('IN_PROGRESS')
        expect(actions).toEqual([
            { targetStatus: 'DONE', label: 'Отметить выполненной', icon: 'check-check', tone: 'brand' },
        ])
    })

    it('REWORK -> один переход "Вернуть в работу" (в IN_PROGRESS)', () => {
        const actions = getTransitionActions('REWORK')
        expect(actions).toEqual([
            { targetStatus: 'IN_PROGRESS', label: 'Вернуть в работу', icon: 'play', tone: 'brand' },
        ])
    })

    it('DONE -> три действия проверки руководителя, в порядке "успешно / на доработку / неуспешно"', () => {
        const actions = getTransitionActions('DONE')
        expect(actions.map((a) => a.targetStatus)).toEqual(['CLOSED_SUCCESSFULLY', 'REWORK', 'CLOSED_UNSUCCESSFULLY'])
        expect(actions).toEqual([
            { targetStatus: 'CLOSED_SUCCESSFULLY', label: 'Закрыть успешно', icon: 'check-check', tone: 'brand' },
            { targetStatus: 'REWORK', label: 'На доработку', icon: 'rotate-ccw', tone: 'violet' },
            { targetStatus: 'CLOSED_UNSUCCESSFULLY', label: 'Закрыть неуспешно', icon: 'x', tone: 'danger' },
        ])
    })

    it.each<TaskStatus>(['CLOSED_SUCCESSFULLY', 'CLOSED_UNSUCCESSFULLY'])(
        '%s (терминальный) -> ни одной кнопки',
        (status) => {
            expect(getTransitionActions(status)).toEqual([])
        },
    )
})

describe('getTransitionHint', () => {
    it('возвращает подсказку для статусов с действиями', () => {
        expect(getTransitionHint('NEW')).toBeTruthy()
        expect(getTransitionHint('IN_PROGRESS')).toBeTruthy()
        expect(getTransitionHint('REWORK')).toBeTruthy()
        expect(getTransitionHint('DONE')).toBeTruthy()
    })

    it('возвращает null для терминальных статусов (нет действий -> нет подсказки над ними)', () => {
        expect(getTransitionHint('CLOSED_SUCCESSFULLY')).toBeNull()
        expect(getTransitionHint('CLOSED_UNSUCCESSFULLY')).toBeNull()
    })
})
