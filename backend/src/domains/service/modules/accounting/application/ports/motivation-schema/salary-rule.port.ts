import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Порт объявляет только реально используемые операции. Методы вроде
// findAll/delete добавляются сюда, когда появляется конкретный вызывающий
// код, а не заранее.
export interface SalaryRuleRepositoryPort {
    insert(
        entity: SalaryRule,
        meta: { motivationSchemaId: string },
    ): Promise<void>;

    // Используется PATCH .../motivation-schema/:id (UpdateMotivationSchemaHandler)
    // для удаления ТОЛЬКО тех правил, которых нет в новом наборе из тела
    // запроса (diff по id, а не полная замена — иначе TaskCompletion теряет
    // привязанную задачу Bitrix24 при каждом PATCH, даже когда правило не
    // менялось, см. design.md Decision 6, add-task-based-salary-rule).
    // Реализация сама фиксирует direction='service' в WHERE, тем же приёмом,
    // что insert()/toPersistence() фиксируют его при записи, чтобы не задеть
    // правила направления shop той же строки motivation_schemas (сотрудник с
    // идентичностями в обеих ERP). Пустой список — no-op, без запроса.
    deleteByIds(ruleIds: string[]): Promise<void>;

    // Правило по id. null, если правила с таким id нет либо оно принадлежит
    // направлению shop (та же фильтрация direction='service' в WHERE, что и
    // у остальных методов этого порта).
    findById(ruleId: string): Promise<SalaryRule | null>;

    // Персист правила ПОСЛЕ создания (не insert — сущность уже существует
    // в БД), для точечных мутаций props правила in-place.
    update(entity: SalaryRule): Promise<void>;
}

export const SALARY_RULE_REPOSITORY = Symbol('SALARY_RULE_REPOSITORY');
