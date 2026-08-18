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
    CREATED_BY: 'Создатель заказа',
    CLOSED_BY: 'Закрывающий заказ',
    ONLINE_PURCHASER: 'Онлайн-закупщик',
    OFFLINE_PURCHASER: 'Офлайн-закупщик',
}
