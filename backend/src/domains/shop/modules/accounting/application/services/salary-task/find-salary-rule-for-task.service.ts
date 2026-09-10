import { Inject, Injectable } from '@nestjs/common';
import type { SalaryRuleSummary } from 'ireports-contracts';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';

// Раздел 17 tasks.md (add-task-salary-rule-links-comments) — зеркало
// domains/service/.../find-salary-rule-for-task.service.ts (см. WHY там).
// spec: shop/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
@Injectable()
export class FindSalaryRuleForTaskService {
    constructor(
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: ShopSalaryRuleRepositoryPort,
    ) {}

    async execute(taskId: string): Promise<SalaryRuleSummary | null> {
        const rule = await this.salaryRuleRepo.findByTaskId(taskId);
        if (!rule) {
            return null;
        }
        return {
            id: rule.id,
            type: rule.type,
            name: rule.name,
            targetRole: rule.targetRole,
        };
    }
}
