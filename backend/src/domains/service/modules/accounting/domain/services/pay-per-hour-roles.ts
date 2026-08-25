import type { TargetRole } from '../types/salary-rule.types';

// Роли графика, чьи рабочие смены засчитываются в часы PayPerHour — «Оффлайн
// менеджер»/«Онлайн менеджер»/«Соло-менеджер» (совмещает обе роли в
// одиночку). Любая другая роль дня графика (в т.ч. ENGINEER/OFFICE —
// инженеры офиса) в часы не входит, отдельной ветки под "офис" не нужно.
// Фиксированный список, не связан с targetRole конкретного экземпляра
// правила (см. pay-per-hour.entity.ts).
export const PAY_PER_HOUR_ELIGIBLE_ROLES: readonly TargetRole[] = [
    'ONLINE_MANAGER',
    'OFFLINE_MANAGER',
    'SOLO_MANAGER',
];
