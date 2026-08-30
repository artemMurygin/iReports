import { shopSalaryRuleRegistry } from '@/domains/shop/modules/accounting/domain/salary-rule-registry';
import type { TargetRole } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

// Допустимые роли по типу правила магазина — вход GET
// /shop/accounting/salary_role_types (Фаза 12, issue #61: "GET списка
// типов правил возвращает разные наборы для service и shop"). Зеркало
// salary-rule-role-catalog.ts сервиса и то же решение: все типы правил
// магазина получают полный перечень ролей магазина, форма не должна
// отказывать в выборе роли там, где контракт её требует — конкретное
// правило само матчит только "свои" роли в рантайме (см.
// employeeMatchesShopDemandRole/employeeMatchesShopPurchaserRole,
// бросающие ArgumentInvalidException для несовместимой роли).
//
// OFFICE (Фаза 2 плана "График работы сотрудников") сюда намеренно не
// входит по той же причине, что и в service-каталоге: список — фиксированный
// литерал, появление OFFICE в targetRoleSchema его не расширяет, а роль
// нужна графику работы, а не зарплатным правилам магазина.
const ALL_SHOP_ROLES: TargetRole[] = [
    'ONLINE_MANAGER',
    'OFFLINE_MANAGER',
    'ONLINE_PURCHASER',
    'OFFLINE_PURCHASER',
];

export interface ShopSalaryRuleTypeCatalogEntry {
    type: string;
    allowedRoles: TargetRole[];
}

export function listShopSalaryRuleTypes(): ShopSalaryRuleTypeCatalogEntry[] {
    return Array.from(shopSalaryRuleRegistry.keys()).map((type) => ({
        type,
        allowedRoles: ALL_SHOP_ROLES,
    }));
}
