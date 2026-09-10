import type { TargetRole } from 'ireports-contracts'

/**
 * Человекочитаемые названия `targetRole` для селекта роли в карточке правила (Шаг 2). Общий enum
 * на оба направления (см. `contracts/commands/salary-rule.ts`, комментарий над
 * `targetRoleSchema`) — этой странице (направление "Сервис") реально видны только роли, которые
 * вернёт `GET /v1/service/accounting/salary_role_types` (сегодня — все, кроме двух
 * shop-специфичных закупщиков, см. `salary-rule-role-catalog.ts` на бэкенде), но карта покрывает
 * весь enum, чтобы не рассыпаться, если бэкенд начнёт отдавать более узкий список.
 */
export const ROLE_LABELS: Record<TargetRole, string> = {
    ENGINEER: 'Инженер',
    ONLINE_MANAGER: 'Онлайн-менеджер',
    OFFLINE_MANAGER: 'Офлайн-менеджер',
    ORDER_MANAGER: 'Менеджер заказов',
    ONLINE_PURCHASER: 'Онлайн-закупщик',
    OFFLINE_PURCHASER: 'Офлайн-закупщик',
    // OFFICE (Фаза 2 плана "График работы сотрудников") — роль офисного
    // сотрудника для графика работы; ни один каталог ролей зарплатных
    // правил её не отдаёт (см. salary-rule-role-catalog.ts на бэкенде), но
    // карта покрывает весь enum контракта, как и остальные записи здесь.
    OFFICE: 'Офис',
    // SOLO_MANAGER — как и OFFICE, роль графика работы, не входящая в
    // ALL_SERVICE_ROLES (её часы всё же участвуют в расчёте PayPerHour, см.
    // pay-per-hour-roles.ts), карта покрывает весь enum по той же причине.
    SOLO_MANAGER: 'Соло-менеджер',
    // DEPARTMENT_HEAD (add-department-head-salary-rules, FR1) — «руководитель направления»:
    // назначается вручную через уже существующий targetType = 'Employee', видна в каталоге ролей
    // (ALL_SERVICE_ROLES/ALL_SHOP_ROLES) как опция для 3 новых видов правил уровня отдела/
    // направления (DepartmentPercent/DepartmentPlanBonus/DepartmentTurnoverBonus, FR2-FR4). Точное
    // имя литерала — открытый вопрос архитектуры (design.md Q1), не влияющий на русский текст.
    DEPARTMENT_HEAD: 'Руководитель направления',
}
