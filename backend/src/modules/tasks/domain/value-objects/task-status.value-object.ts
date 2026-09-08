import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

// specs/tasks/spec.md, Requirement: «Жизненный цикл статуса задачи» +
// design.md Decision 3 — шесть статусов, линейный граф с ревью-циклом:
//   NEW → IN_PROGRESS → DONE → { CLOSED_SUCCESSFULLY, CLOSED_UNSUCCESSFULLY, REWORK }
//   REWORK → IN_PROGRESS
// CLOSED_SUCCESSFULLY/CLOSED_UNSUCCESSFULLY — терминальные, из них
// переходов нет (спека: «любой запрос на изменение статуса этой задачи
// отклоняется»). Единственное исключение из этого графа —
// Task.cancelForRuleDeletion() (см. domain/entities/task.entity.ts): он
// НЕ идёт через canTransitionTo, а переводит задачу в CLOSED_UNSUCCESSFULLY
// напрямую из любого нетерминального статуса (design.md Decision 3,
// «Отмена при удалении правила» — системный переход вне обычного графа
// self-service действий).
export type TaskStatusCode =
    | 'NEW'
    | 'IN_PROGRESS'
    | 'DONE'
    | 'CLOSED_SUCCESSFULLY'
    | 'CLOSED_UNSUCCESSFULLY'
    | 'REWORK';

const ALL_CODES: readonly TaskStatusCode[] = [
    'NEW',
    'IN_PROGRESS',
    'DONE',
    'CLOSED_SUCCESSFULLY',
    'CLOSED_UNSUCCESSFULLY',
    'REWORK',
];

const TERMINAL_CODES: ReadonlySet<TaskStatusCode> = new Set([
    'CLOSED_SUCCESSFULLY',
    'CLOSED_UNSUCCESSFULLY',
]);

const TRANSITIONS: Record<TaskStatusCode, readonly TaskStatusCode[]> = {
    NEW: ['IN_PROGRESS'],
    IN_PROGRESS: ['DONE'],
    DONE: ['CLOSED_SUCCESSFULLY', 'CLOSED_UNSUCCESSFULLY', 'REWORK'],
    REWORK: ['IN_PROGRESS'],
    CLOSED_SUCCESSFULLY: [],
    CLOSED_UNSUCCESSFULLY: [],
};

export class TaskStatus extends ValueObject<string> {
    static fromCode(code: string): TaskStatus {
        if (!ALL_CODES.includes(code as TaskStatusCode)) {
            throw new ArgumentInvalidException(
                `Недопустимый статус задачи: "${code}"`,
            );
        }
        return new TaskStatus({ value: code });
    }

    static new(): TaskStatus {
        return TaskStatus.fromCode('NEW');
    }

    static closedUnsuccessfully(): TaskStatus {
        return TaskStatus.fromCode('CLOSED_UNSUCCESSFULLY');
    }

    get code(): TaskStatusCode {
        return this.unpack() as TaskStatusCode;
    }

    canTransitionTo(next: TaskStatus): boolean {
        return TRANSITIONS[this.code].includes(next.code);
    }

    isTerminal(): boolean {
        return TERMINAL_CODES.has(this.code);
    }
}
