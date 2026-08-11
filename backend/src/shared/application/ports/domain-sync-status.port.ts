import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Штамп последней успешной синхронизации домена с ERP — вход ленивого кэша
// расчёта зарплаты (Фаза 6, см. docs/payroll/plan-payroll-calculation.md).
// Порт живёт в src/shared, а не в domains/service/modules/accounting: и
// service (RoappSyncCron), и будущий shop-синк (Фаза 11+) обновляют одну и
// ту же таблицу по своему направлению — это не бизнес-логика конкретного
// домена, а инфраструктурный примитив, общий для обоих (см. calculation-context.ts,
// уже вынесенный сюда по той же причине).
export interface DomainSyncStatusPort {
    // null — синхронизация направления ещё ни разу не завершалась успешно
    // (свежая БД/dev-среда до первого тика крона).
    getLastSuccessfulSyncAt(
        direction: AccountingDirection,
    ): Promise<Date | null>;

    // Вызывается в конце успешного прохода синхронизации (см.
    // RoappSyncCron.run()) — саму синхронизацию не переписывает, только
    // фиксирует штамп.
    markSuccessful(direction: AccountingDirection, at?: Date): Promise<void>;
}

export const DOMAIN_SYNC_STATUS = Symbol('DOMAIN_SYNC_STATUS');
