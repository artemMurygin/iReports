import { ConflictException, NotFoundException } from '@/shared/exceptions';

export class ShopTaskCompletionNotFoundException extends NotFoundException {
    constructor(message = 'Запись о выполнении задачи не найдена') {
        super(message);
    }
}

// Подтвердить/отклонить можно только запись, ожидающую подтверждения — см.
// ShopTaskCompletion.confirm()/.reject() (Фаза 13.5, зеркало
// TaskCompletionInvalidStatusTransitionException домена service).
export class ShopTaskCompletionInvalidStatusTransitionException extends ConflictException {
    constructor(currentStatus: string) {
        super(
            `Нельзя изменить статус записи о выполнении задачи из "${currentStatus}" — ` +
                'подтвердить или отклонить можно только запись в статусе "PENDING_CONFIRMATION"',
        );
    }
}
