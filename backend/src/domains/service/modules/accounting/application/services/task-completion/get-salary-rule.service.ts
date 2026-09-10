import { Inject, Injectable } from '@nestjs/common';
import type { SalaryRuleDetail } from 'ireports-contracts';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { SalaryRuleNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-rule.exception';

// Раздел 18 tasks.md (add-task-salary-rule-links-comments) — тонкая
// read-обёртка над уже существующим SalaryRuleRepositoryPort.findById для
// боковой панели правила (features/SalaryRuleDetailsPanel, GET
// .../salary-rules/:ruleId, раздел 19). motivationSchemaName — резолвится
// отдельным вызовом MotivationSchemaRepositoryPort.findById по
// motivationSchemaId (SalaryRule как доменная сущность его не хранит, см.
// WHY на SalaryRuleRepositoryPort.findMotivationSchemaId) — ui-design.md,
// отклонение №1 от architecture.md. spec:
// service/accounting#requirement-зарплатное-правило-доступно-для-получения-по-собственному-идентификатору
@Injectable()
export class GetSalaryRuleService {
    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: SalaryRuleRepositoryPort,
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        private readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
    ) {}

    async execute(ruleId: string): Promise<SalaryRuleDetail> {
        const rule = await this.salaryRuleRepo.findById(ruleId);
        if (!rule) {
            throw new SalaryRuleNotFoundException(ruleId);
        }

        const motivationSchemaId =
            await this.salaryRuleRepo.findMotivationSchemaId(ruleId);
        const schema = motivationSchemaId
            ? await this.motivationSchemaRepo.findById(motivationSchemaId)
            : null;

        // rule.type/rule.config типизированы как string/SalaryRuleConfig
        // (union) на доменном уровне (см. SalaryRule в salary-rule.types.ts)
        // — приведение к дискриминированному SalaryRuleDetail безопасно:
        // оба поля уже прошли валидацию соответствующей zod-схемой в
        // SalaryRuleMapper.toDomain при чтении из БД.
        return {
            id: rule.id,
            type: rule.type,
            name: rule.name,
            targetRole: rule.targetRole,
            direction: 'service',
            config: rule.config,
            motivationSchemaName: schema?.getProps().name ?? 'Неизвестно',
        } as SalaryRuleDetail;
    }
}
