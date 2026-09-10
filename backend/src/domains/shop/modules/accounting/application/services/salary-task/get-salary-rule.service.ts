import { Inject, Injectable } from '@nestjs/common';
import type { SalaryRuleDetail } from 'ireports-contracts';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { ShopSalaryRuleNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/salary-rule.exception';

// Раздел 18 tasks.md (add-task-salary-rule-links-comments) — зеркало
// domains/service/.../get-salary-rule.service.ts (см. WHY там). spec:
// shop/accounting#requirement-зарплатное-правило-доступно-для-получения-по-собственному-идентификатору
@Injectable()
export class GetSalaryRuleService {
    constructor(
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: ShopSalaryRuleRepositoryPort,
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        private readonly motivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
    ) {}

    async execute(ruleId: string): Promise<SalaryRuleDetail> {
        const rule = await this.salaryRuleRepo.findById(ruleId);
        if (!rule) {
            throw new ShopSalaryRuleNotFoundException(ruleId);
        }

        const motivationSchemaId =
            await this.salaryRuleRepo.findMotivationSchemaId(ruleId);
        const schema = motivationSchemaId
            ? await this.motivationSchemaRepo.findById(motivationSchemaId)
            : null;

        // rule.type/rule.config типизированы как string/ShopSalaryRuleConfig
        // (union) на доменном уровне — см. WHY у аналогичного каста в
        // domains/service/.../get-salary-rule.service.ts.
        return {
            id: rule.id,
            type: rule.type,
            name: rule.name,
            targetRole: rule.targetRole,
            direction: 'shop',
            config: rule.config,
            motivationSchemaName: schema?.getProps().name ?? 'Неизвестно',
        } as SalaryRuleDetail;
    }
}
