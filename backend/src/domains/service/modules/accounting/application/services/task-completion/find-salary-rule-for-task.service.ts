import { Inject, Injectable } from '@nestjs/common';
import type { SalaryRuleSummary } from 'ireports-contracts';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';

// Раздел 17 tasks.md (add-task-salary-rule-links-comments) — читается
// фронтендом (блок «Зарплатное правило» на карточке задачи,
// tasks/salary-rule-panel) через новый HTTP-эндпоинт раздела 19, не
// вызывается напрямую из `modules/tasks` (design.md решение 2: backend
// modules/tasks не получает нового кода, читающего таблицы accounting).
// Оркестрирует уже существующий SalaryRuleRepositoryPort.findByTaskId —
// сама доступа к БД не имеет. spec:
// service/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
@Injectable()
export class FindSalaryRuleForTaskService {
    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: SalaryRuleRepositoryPort,
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
