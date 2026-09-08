import { NotFoundException } from '@/shared/exceptions';

// Отдельного AlreadyExists-исключения у графика нет (в отличие от
// EmployeeHoursEntry): заполнение дня — идемпотентный upsert, повтор на ту
// же пару (сотрудник, дата) правит запись, а не конфликтует с ней.
export class WorkScheduleEntryNotFoundException extends NotFoundException {
    constructor(message = 'Запись графика работы не найдена') {
        super(message);
    }
}
