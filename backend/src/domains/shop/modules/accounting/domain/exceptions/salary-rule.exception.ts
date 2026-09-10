import { ExceptionBase } from '@/shared/exceptions';
import { SALARY_RULE_NOT_FOUND } from '@/shared/exceptions/exception.codes';

// Раздел 18 tasks.md (add-task-salary-rule-links-comments) — зеркало
// domains/service/.../salary-rule.exception.ts'ного SalaryRuleNotFoundException
// (issue #57, независимая копия), брошено GetShopSalaryRuleService. spec:
// shop/accounting#requirement-зарплатное-правило-доступно-для-получения-по-собственному-идентификатору
export class ShopSalaryRuleNotFoundException extends ExceptionBase {
    readonly code = SALARY_RULE_NOT_FOUND;

    constructor(ruleId: string) {
        super(`Зарплатное правило ${ruleId} не найдено`);
    }
}
