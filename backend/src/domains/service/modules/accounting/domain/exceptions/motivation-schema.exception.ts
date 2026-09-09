import { ArgumentInvalidException } from '@/shared/exceptions';

// Продуктовое решение (после add-task-based-salary-rule): правило
// TaskCompletion можно создать только на мотивационную схему конкретного
// сотрудника (MotivationTarget.isEmployee()), не на схему отдела — снимает
// прежний открытый вопрос про выбор "ответственного" среди сотрудников
// отдела при уникальном (salaryRuleId, period). Брошено
// CreateSalaryRuleHandler (service) до похода в Bitrix24; у shop —
// независимый аналог в domains/shop/modules/accounting/domain/exceptions/.
export class TaskCompletionRequiresPersonalSchemaException extends ArgumentInvalidException {
    constructor() {
        super(
            'Правило «За выполнение задачи» можно создать только на мотивационную схему ' +
                'конкретного сотрудника, а не отдела',
        );
    }
}
