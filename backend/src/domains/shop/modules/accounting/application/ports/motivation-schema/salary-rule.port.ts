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
    // схемы) — «переименовать + удалить все правила НАПРАВЛЕНИЯ shop этой
    // схемы + пересоздать из payload» (см. UpdateShopMotivationSchemaHandler).
    // Реализация фиксирует direction='shop' в WHERE — критично: у одной
    // строки motivation_schemas может быть смешанный набор правил
    // service+shop (сотрудник с идентичностями в обеих ERP, см. комментарий
    // у SalaryRule.direction в salary.prisma), удаление не должно задевать
    // чужие (service) правила той же схемы.
    deleteAllByMotivationSchema(motivationSchemaId: string): Promise<void>;
}

export const SHOP_SALARY_RULE_REPOSITORY = Symbol(
    'SHOP_SALARY_RULE_REPOSITORY',
);
