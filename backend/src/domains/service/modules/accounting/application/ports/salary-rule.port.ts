import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Порт объявляет только реально используемую операцию (сейчас — только
// insert из CreateSalaryRuleHandler). Методы вроде findAll/delete
// добавляются сюда, когда появляется конкретный вызывающий код, а не заранее.
export interface SalaryRuleRepositoryPort {
    insert(
        entity: SalaryRule,
        meta: { motivationSchemaId: string },
    ): Promise<void>;
}

export const SALARY_RULE_REPOSITORY = Symbol('SALARY_RULE_REPOSITORY');
