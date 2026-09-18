import {
    DomainEvent,
    DomainEventProps,
} from '@/shared/domain/domain-event.base';
import type { TaskStatusCode } from '../value-objects/task-status.value-object';

// openspec/changes/deactivate-one-off-task-completion-rule/specs/tasks/spec.md,
// Requirement: «Задача уведомляет о переходе в терминальный статус» —
// design.md Decision 1: единое событие для обоих терминальных статусов
// («Закрыта успешно»/«Закрыто неуспешно»), фильтрация по status — на
// стороне подписчика. Несёт только taskId/status — минимум, достаточный
// потребителю, без раскрытия задаче знания о том, кто на неё подписан (см.
// specs/tasks/spec.md, Requirement: «Задача — полностью самостоятельная
// сущность, не знающая о зарплатных правилах»).
export class TaskClosedDomainEvent extends DomainEvent {
    readonly taskId: string;

    readonly status: TaskStatusCode;

    constructor(props: DomainEventProps<TaskClosedDomainEvent>) {
        super(props);
        this.taskId = props.taskId;
        this.status = props.status;
    }
}
