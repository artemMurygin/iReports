import { ExceptionBase, NotFoundException } from '@/shared/exceptions';
import { INVALID_TASK_TRANSITION } from '@/shared/exceptions/exception.codes';

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
