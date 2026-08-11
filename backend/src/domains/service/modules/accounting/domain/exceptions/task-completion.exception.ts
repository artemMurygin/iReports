import { ConflictException, NotFoundException } from '@/shared/exceptions';

export class TaskCompletionNotFoundException extends NotFoundException {
    constructor(message = 'Запись о выполнении задачи не найдена') {
        super(message);
    }
}

// Подтвердить/отклонить можно только запись, ожидающую подтверждения — см.
// TaskCompletion.confirm()/.reject() (Фаза 8).
export class TaskCompletionInvalidStatusTransitionException extends ConflictException {
    constructor(currentStatus: string) {
        super(
            `Нельзя изменить статус записи о выполнении задачи из "${currentStatus}" — ` +
                'подтвердить или отклонить можно только запись в статусе "PENDING_CONFIRMATION"',
        );
    }
}
