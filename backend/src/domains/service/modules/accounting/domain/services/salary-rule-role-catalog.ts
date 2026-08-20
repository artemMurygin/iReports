import { salaryRuleRegistry } from '@/domains/service/modules/accounting/domain/salary-rule-registry';
import type { TargetRole } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Допустимые роли по типу правила — вход для GET /accounting/salary_role_types
// (Фаза 8, "Когда готово" плана: "GET /accounting/salary_role_types отдаёт
// полный набор с ролями"). Решение по этому открытому вопросу (не описан
// явно в PRD): все четыре типа правил сервиса используют один и тот же
// ролевой источник (см. service-role-source.ts) — ни PayPerHour,
// ServiceCompleted, ни OrderPayed архитектурно не ограничены подмножеством
// ролей, поэтому в первой итерации им всем доступен полный перечень ролей
// сервиса. TaskCompleted — исключение по факту матчинга (не ролевой, а по
// прямой идентичности сотрудника, см. task-completed.entity.ts), но поле
// targetRole всё равно обязательно в форме (общая часть контракта для всех
// типов), поэтому и для него отдаётся тот же полный список — форма не
// должна отказывать в выборе роли там, где контракт её требует.
const ALL_SERVICE_ROLES: TargetRole[] = [
    'ENGINEER',
    'ONLINE_MANAGER',
    'OFFLINE_MANAGER',
    'ORDER_MANAGER',
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
