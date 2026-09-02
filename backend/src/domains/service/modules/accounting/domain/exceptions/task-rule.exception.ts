import { ConflictException, NotFoundException } from '@/shared/exceptions';

// Requirement "Создание правила-задачи только в схеме на сотрудника"
// (spec.md change salary-rule-bitrix-task) — защита на бэкенде: без
// ответственного (сотрудника — цели схемы) задачу Bitrix24 создать нельзя,
// см. CreateSalaryRuleHandler.
export class TaskRuleRequiresEmployeeTargetException extends ConflictException {
    constructor() {
        super(
            'Правило "выполненная задача" доступно только в схеме мотивации, ' +
                'нацеленной на конкретного сотрудника',
        );
    }
}

// Requirement "Удаление задачи Bitrix24 при удалении правила или схемы" —
// удаление задачи в Bitrix24 завершилось ошибкой, правило (и вся схема
// целиком, в этой реализации — полная замена набора правил) не удаляется.
export class TaskRuleBitrixDeletionFailedException extends ConflictException {
    constructor(taskId: number, cause?: Error) {
        super(
            `Не удалось удалить задачу Bitrix24 ${taskId} — правило-задача не удалено`,
            cause,
            { taskId, reason: cause?.message ?? null },
        );
    }
}

// Ручной ввод фактической суммы (spec.md, "Ручной ввод фактической суммы по
// закрытой задаче") — правило-задача с этим id не найдено, либо найдено, но
// это не TaskCompleted.
export class TaskRuleNotFoundException extends NotFoundException {
    constructor(ruleId: string) {
        super(`Правило-задача ${ruleId} не найдено`);
    }
}

// Диапазон 0..сумма правила включительно (spec.md, "Значение вне диапазона
// отклоняется").
export class TaskRuleActualAmountOutOfRangeException extends ConflictException {
    constructor(actualAmount: number, rewardAmount: number) {
        super(
            `Фактическая сумма ${actualAmount} должна быть в диапазоне 0..${rewardAmount} ` +
                '(сумма правила) включительно',
            undefined,
            { actualAmount, rewardAmount },
        );
    }
}

// Requirement "Поле недоступно для незакрытой задачи" (spec.md) — задача
// правила за запрошенный период не в статусе "Закрыта" (или недоступна) на
// момент запроса.
export class TaskRuleNotCompletedException extends ConflictException {
    constructor(ruleId: string, period: string) {
        super(
            `Задача правила ${ruleId} за период ${period} не в статусе "Закрыта" ` +
                'или недоступна — фактическую сумму указать нельзя',
            undefined,
            { ruleId, period },
        );
    }
}
