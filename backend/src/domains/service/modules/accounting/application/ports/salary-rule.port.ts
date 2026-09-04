import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Порт объявляет только реально используемые операции. Методы вроде
// findAll/delete добавляются сюда, когда появляется конкретный вызывающий
// код, а не заранее.
export interface SalaryRuleRepositoryPort {
    insert(
        entity: SalaryRule,
        meta: { motivationSchemaId: string },
    ): Promise<void>;

    // Используется PATCH .../motivation-schema/:id перед пересозданием
    // правил из тела запроса (см. UpdateMotivationSchemaHandler) —
    // реализация сама фиксирует direction='service' в WHERE, тем же
    // приёмом, что insert()/toPersistence() фиксируют его при записи, чтобы
    // не задеть правила направления shop той же строки motivation_schemas
    // (сотрудник с идентичностями в обеих ERP).
    deleteAllByMotivationSchema(motivationSchemaId: string): Promise<void>;

    // Правило по id. null, если правила с таким id нет либо оно принадлежит
    // направлению shop (та же фильтрация direction='service' в WHERE, что и
    // у остальных методов этого порта).
    findById(ruleId: string): Promise<SalaryRule | null>;

    // Персист правила ПОСЛЕ создания (не insert — сущность уже существует
    // в БД), для точечных мутаций props правила in-place.
    update(entity: SalaryRule): Promise<void>;
}

export const SALARY_RULE_REPOSITORY = Symbol('SALARY_RULE_REPOSITORY');
