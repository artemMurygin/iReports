import { ConflictException, NotFoundException } from '@/shared/exceptions';

// Повторное создание записи часов на ту же пару (employeeId, period)
// отклоняется — см. @@unique в salary.prisma, эта проверка дублирует его на
// уровне приложения ради дружелюбного сообщения (тот же приём, что и у
// SalesPlanAlreadyExistsException).
export class EmployeeHoursEntryAlreadyExistsException extends ConflictException {}

export class EmployeeHoursEntryNotFoundException extends NotFoundException {
    constructor(message = 'Запись часов сотрудника не найдена') {
        super(message);
    }
}
