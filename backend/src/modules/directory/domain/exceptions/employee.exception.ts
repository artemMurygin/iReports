import { NotFoundException } from '@/shared/exceptions';

// Сотрудник с переданным id не найден в справочнике Bitrix
// (SetEmployeeServiceAccountHandler) — тот же приём, что и у
// EmployeeIdentityNotFoundException/WorkScheduleEntryNotFoundException:
// найти, потом действовать, а не полагаться на ошибку ORM.
export class EmployeeNotFoundException extends NotFoundException {
    constructor(message = 'Сотрудник не найден') {
        super(message);
    }
}
