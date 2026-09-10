import { salaryRuleRegistry } from '@/domains/service/modules/accounting/domain/salary-rule-registry';
import type { TargetRole } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Допустимые роли по типу правила — вход для GET /accounting/salary_role_types
// (Фаза 8, "Когда готово" плана: "GET /accounting/salary_role_types отдаёт
// полный набор с ролями"). Решение по этому открытому вопросу (не описан
// явно в PRD): все три типа правил сервиса используют один и тот же
// ролевой источник (см. service-role-source.ts) — ни PayPerHour,
// ServiceCompleted, ни OrderPayed архитектурно не ограничены подмножеством
// ролей, поэтому в первой итерации им всем доступен полный перечень ролей
// сервиса.
//
// OFFICE (Фаза 2 плана "График работы сотрудников") сюда намеренно не
// входит: список — фиксированный литерал, а не производный от полного
// targetRoleSchema, поэтому появление OFFICE в контракте не расширяет этот
// каталог само по себе. Роль нужна графику работы (WorkScheduleEntry.role),
// а не зарплатным правилам сервиса — ни одно из них её не матчит.
//
// DEPARTMENT_HEAD (FR1 add-department-head-salary-rules) — «руководитель направления»: единственная
// цель добавления в каталог — чтобы UI показывал роль как опцию для 3 новых видов правила уровня
// отдела (DepartmentPercent/DepartmentPlanBonus/DepartmentTurnoverBonus, design.md Decision 4).
// Каталог не различает типы правил (см. listSalaryRuleTypes ниже — один и тот же список для всех
// зарегистрированных типов), поэтому роль видна и у существующих 4 транзакционных видов правил —
// их role-source.ts её не матчит, так что выбор роли там просто не имеет эффекта.
const ALL_SERVICE_ROLES: TargetRole[] = [
    'ENGINEER',
    'ONLINE_MANAGER',
    'OFFLINE_MANAGER',
    'ORDER_MANAGER',
    'DEPARTMENT_HEAD',
];

export interface SalaryRuleTypeCatalogEntry {
    type: string;
    allowedRoles: TargetRole[];
}

export function listSalaryRuleTypes(): SalaryRuleTypeCatalogEntry[] {
    return Array.from(salaryRuleRegistry.keys()).map((type) => ({
        type,
        allowedRoles: ALL_SERVICE_ROLES,
    }));
}
