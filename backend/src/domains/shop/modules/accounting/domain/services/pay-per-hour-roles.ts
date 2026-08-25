import type { TargetRole } from '../types/shop-salary-rule.types';

// Зеркало pay-per-hour-roles.ts сервиса — роли графика, чьи рабочие смены
// засчитываются в часы PayPerHour: «Оффлайн менеджер»/«Онлайн менеджер».
// Фиксированный список, не связан с targetRole конкретного экземпляра
// правила (см. pay-per-hour.entity.ts).
export const PAY_PER_HOUR_ELIGIBLE_ROLES: readonly TargetRole[] = [
    'ONLINE_MANAGER',
    'OFFLINE_MANAGER',
];
