import { ExceptionBase, NotFoundException } from '@/shared/exceptions';
import {
    INVALID_TASK_LINK_URL,
    INVALID_TASK_TRANSITION,
    TASK_ALREADY_CLOSED,
    TASK_COMMENT_BODY_EMPTY,
} from '@/shared/exceptions/exception.codes';

// specs/tasks/spec.md, Requirement: «Жизненный цикл статуса задачи» —
// запрошенный переход не входит в список допустимых для текущего статуса
// задачи (TaskStatus.canTransitionTo). Брошено ДО любой мутации состояния
// Task — see Task.transitionTo.
export class InvalidTaskTransitionException extends ExceptionBase {
    readonly code = INVALID_TASK_TRANSITION;
}

export class TaskNotFoundException extends NotFoundException {
    constructor(message = 'Задача не найдена') {
        super(message);
    }
}

// openspec/changes/edit-task/specs/tasks/spec.md, Requirement:
// «Редактирование полей активной задачи» — попытка изменить title/
// description/deadline/assigneeEmployeeId задачи, уже находящейся в
// терминальном статусе (CLOSED_SUCCESSFULLY/CLOSED_UNSUCCESSFULLY). Брошено
// ДО любой мутации состояния — см. Task.update.
export class TaskAlreadyClosedException extends ExceptionBase {
    readonly code = TASK_ALREADY_CLOSED;
}

// spec: tasks/comments#requirement-пустой-комментарий-отклоняется — текст
// комментария пуст или состоит только из пробельных символов. Брошено ДО
// сохранения комментария — см. TaskCommentBody.create.
export class TaskCommentBodyEmptyException extends ExceptionBase {
    readonly code = TASK_COMMENT_BODY_EMPTY;
}

// spec: tasks/links#requirement-ссылка-должна-быть-валидным-адресом —
// значение ссылки не является синтаксически валидным URL. Брошено ДО
// сохранения ссылки — см. TaskLinkUrl.create.
export class InvalidTaskLinkUrlException extends ExceptionBase {
    readonly code = INVALID_TASK_LINK_URL;
}

// spec: tasks/links#requirement-ссылка-удаляется-из-карточки-задачи —
// запрошенная ссылка не найдена среди ссылок задачи (уже удалена, либо
// принадлежит другой задаче) — RemoveTaskLinkHandler бросает это ДО вызова
// TaskLinkRepositoryPort.delete, чтобы не затронуть чужие ссылки.
export class TaskLinkNotFoundException extends NotFoundException {
    constructor(message = 'Ссылка не найдена') {
        super(message);
    }
}
