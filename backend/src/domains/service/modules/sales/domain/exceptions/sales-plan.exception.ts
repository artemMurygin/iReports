import { ConflictException, NotFoundException } from '@/shared/exceptions';

// Повторное создание плана/строки шаблона на ту же комбинацию
// (direction, department, category[, period]) отклоняется — см.
// @@unique в sales.prisma, эта проверка дублирует его на уровне приложения
// ради дружелюбного сообщения (последняя линия защиты — уникальный индекс
// в БД, как и в EmployeeIdentity).
export class SalesPlanAlreadyExistsException extends ConflictException {}

export class SalesPlanNotFoundException extends NotFoundException {
    constructor(message = 'План продаж не найден') {
        super(message);
    }
}
