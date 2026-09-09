import { ArgumentInvalidException } from '@/shared/exceptions';

// Продуктовое решение (после add-task-based-salary-rule): правило
// TaskCompletion можно создать только на мотивационную схему конкретного
// сотрудника (ShopMotivationTarget.isEmployee()), не на схему отдела —
// снимает прежний открытый вопрос про выбор "ответственного" среди
// сотрудников отдела при уникальном (salaryRuleId, period). Брошено
// CreateShopSalaryRuleHandler до похода в Bitrix24; зеркало
// domains/service/modules/accounting/domain/exceptions/motivation-schema.exception.ts
// (issue #57, независимая копия).
export class TaskCompletionRequiresPersonalSchemaException extends ArgumentInvalidException {
    constructor() {
        super(
            'Правило «За выполнение задачи» можно создать только на мотивационную схему ' +
                'конкретного сотрудника, а не отдела',
        );
    }
}
