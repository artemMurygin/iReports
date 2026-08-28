import { Period } from '@/shared/domain/period.value-object';

// Синхронизация ERP направления за месяц по требованию — внутренний шаг
// закрытия расчётного периода (PRD 1 docs/payroll-closing-and-accrual,
// "Финальный пересчёт при закрытии"): service — заказы RemOnline, закрытые
// в месяце, shop — отгрузки МойСклада с датой в месяце. Порт
// direction-агностичен: каждый accounting-модуль провайдит под этим токеном
// адаптер к синку своей ERP (см. RoappErpPeriodSyncAdapter /
// MoySkladErpPeriodSyncAdapter). Ошибка реализации — обычный reject; в
// ErpSyncFailedException её заворачивает ErpPeriodSyncRunner вместе с
// таймаутом.
export interface ErpPeriodSyncPort {
    syncPeriod(period: Period): Promise<void>;
}

export const ERP_PERIOD_SYNC = Symbol('ERP_PERIOD_SYNC');
