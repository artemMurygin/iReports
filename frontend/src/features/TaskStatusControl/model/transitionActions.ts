import type { TaskStatus } from 'ireports-contracts'

/**
 * replace-bitrix-task-integration, tasks.md 12.1/12.3 — какие кнопки перехода показывает
 * `TaskTransitionActions` для каждого статуса задачи, по графу `TaskStatus.canTransitionTo`
 * (specs/tasks/spec.md «Жизненный цикл статуса задачи»): `NEW`/`IN_PROGRESS` — один шаг вперёд по
 * цепочке ответственного (`kf1uq`); `DONE` — три действия проверки руководителя (`QpFcx`);
 * `REWORK` — «вернуть в работу»; `CLOSED_SUCCESSFULLY`/`CLOSED_UNSUCCESSFULLY` — ни одной (`yZE5X`).
 *
 * Решение из tasks.md ("Решения, зафиксированные перед написанием этого списка", RBAC): набор
 * действий читается ИСКЛЮЧИТЕЛЬНО из текущего статуса задачи, а не из отдельно переданной роли —
 * поэтому `getTransitionActions` принимает только `status`, без `actorRole`/`actorEmployeeId`.
 */
export type TransitionTone = 'brand' | 'violet' | 'danger'

export type TransitionIcon = 'play' | 'check-check' | 'rotate-ccw' | 'x'

export type TransitionAction = {
    targetStatus: TaskStatus
    label: string
    icon: TransitionIcon
    tone: TransitionTone
}

const ASSIGNEE_HINT = 'Вы назначены ответственным за эту задачу'

const TRANSITION_HINT: Partial<Record<TaskStatus, string>> = {
    NEW: ASSIGNEE_HINT,
    IN_PROGRESS: ASSIGNEE_HINT,
    REWORK: 'Задача возвращена на доработку — переведите её обратно в работу',
    DONE: 'Ответственный заявил задачу выполненной — подтвердите или верните на доработку',
}

/** Подсказка над кнопками действий (`Блок · Действия`'s "Hint" в Pencil-фреймах `kf1uq`/`QpFcx`) —
 * `null`, когда для статуса нет действий (терминальные статусы вместо этого показывают отдельную
 * пометку результата, см. `TaskStatusCard`'s "Note"). */
export function getTransitionHint(status: TaskStatus): string | null {
    return TRANSITION_HINT[status] ?? null
}

export function getTransitionActions(status: TaskStatus): TransitionAction[] {
    switch (status) {
        case 'NEW':
            return [{ targetStatus: 'IN_PROGRESS', label: 'Взять в работу', icon: 'play', tone: 'brand' }]
        case 'IN_PROGRESS':
            return [{ targetStatus: 'DONE', label: 'Отметить выполненной', icon: 'check-check', tone: 'brand' }]
        case 'REWORK':
            return [{ targetStatus: 'IN_PROGRESS', label: 'Вернуть в работу', icon: 'play', tone: 'brand' }]
        case 'DONE':
            return [
                { targetStatus: 'CLOSED_SUCCESSFULLY', label: 'Закрыть успешно', icon: 'check-check', tone: 'brand' },
                { targetStatus: 'REWORK', label: 'На доработку', icon: 'rotate-ccw', tone: 'violet' },
                { targetStatus: 'CLOSED_UNSUCCESSFULLY', label: 'Закрыть неуспешно', icon: 'x', tone: 'danger' },
            ]
        case 'CLOSED_SUCCESSFULLY':
        case 'CLOSED_UNSUCCESSFULLY':
            return []
    }
}
