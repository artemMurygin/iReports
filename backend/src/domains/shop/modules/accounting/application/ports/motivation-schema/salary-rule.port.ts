import { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

// Зеркало domains/service/modules/accounting/application/ports/
// salary-rule.port.ts (Фаза 13.5, issue #57) — независимая копия для
// направления shop. Порт объявляет только реально используемую операцию
// (сейчас — только insert из CreateShopSalaryRuleHandler). Методы вроде
// findAll/delete добавляются сюда, когда появляется конкретный вызывающий
// код, а не заранее.
export interface ShopSalaryRuleRepositoryPort {
    insert(
        entity: ShopSalaryRule,
        meta: { motivationSchemaId: string },
    ): Promise<void>;

    // PATCH /v1/shop/accounting/motivation-schema/:id (редактирование
    // схемы) — удаляет ТОЛЬКО правила, которых нет в новом наборе из тела
    // запроса (diff по id, см. UpdateShopMotivationSchemaHandler) — не
    // полная замена, иначе TaskCompletion теряет привязанную задачу
    // Bitrix24 при каждом PATCH, даже когда правило не менялось (design.md
    // Decision 6, add-task-based-salary-rule). Реализация фиксирует
    // direction='shop' в WHERE — критично: у одной строки motivation_schemas
    // может быть смешанный набор правил service+shop (сотрудник с
    // идентичностями в обеих ERP, см. комментарий у SalaryRule.direction в
    // salary.prisma), удаление не должно задевать чужие (service) правила
    // той же схемы. Пустой список — no-op, без запроса.
    deleteByIds(ruleIds: string[]): Promise<void>;

    // Персист правила ПОСЛЕ создания (не insert — сущность уже существует в
    // БД), для точечных мутаций props правила in-place — используется
    // UpdateShopMotivationSchemaHandler для правил, сохранившихся между
    // PATCH (совпали по id), чтобы id/связанные сущности (SalaryTask у
    // TaskCompletion) не терялись при правке содержимого правила.
    update(entity: ShopSalaryRule): Promise<void>;

    // Раздел 16 tasks.md (add-task-based-salary-rule) — правило по id, для
    // чтения TaskCompletionShopSalaryConfig в EnsureShopSalaryTaskForPeriodService.
    // ensure() (раздел 16). null, если правила с таким id нет либо оно
    // принадлежит направлению service (та же фильтрация direction='shop' в
    // WHERE, что и у остальных методов этого порта) — тот же плоский тип
    // ShopSalaryRule, что и у зеркального метода направления service
    // (application/ports/motivation-schema/salary-rule.port.ts, раздел 11).
    // responsibleBitrixUserId для createTask() — забота ВЫЗЫВАЮЩЕГО кода
    // (report-сервисы/крон уже знают employeeId, см.
    // EnsureShopSalaryTaskForPeriodService.ensure()), этот метод не
    // обходит мотивационные схемы и не резолвит ответственного.
    findById(ruleId: string): Promise<ShopSalaryRule | null>;
}

export const SHOP_SALARY_RULE_REPOSITORY = Symbol(
    'SHOP_SALARY_RULE_REPOSITORY',
);
