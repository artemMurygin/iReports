import { ExceptionBase } from '@/shared/exceptions';
import { SALARY_RULE_NOT_FOUND } from '@/shared/exceptions/exception.codes';

// Раздел 18 tasks.md (add-task-salary-rule-links-comments) — брошено
// GetSalaryRuleService, если у запрошенного ruleId нет строки в направлении
// service (или она принадлежит направлению shop — та же фильтрация
// direction, что и у остальных методов SalaryRuleRepositoryPort). spec:
// service/accounting#requirement-зарплатное-правило-доступно-для-получения-по-собственному-идентификатору
export class SalaryRuleNotFoundException extends ExceptionBase {
    readonly code = SALARY_RULE_NOT_FOUND;

    constructor(ruleId: string) {
        super(`Зарплатное правило ${ruleId} не найдено`);
    }
}
