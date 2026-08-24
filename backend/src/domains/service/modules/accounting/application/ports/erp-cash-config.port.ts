import { ErpCashConfig } from '@/domains/service/modules/accounting/domain/entities/erp-cash-config.entity';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Конфигурация кассы направления (PRD 3, Фаза 11) — direction-агностичный
// порт, как AccountingPeriodRepositoryPort: физически определён в
// domains/service, domains/shop заводит собственный экземпляр реализации
// под тем же токеном (см. domains/service/CLAUDE.md, раздел про
// ACCOUNTING_PERIOD_REPOSITORY/BALANCE_TRANSACTION_REPOSITORY).
export interface ErpCashConfigRepositoryPort {
    // null — направление ещё ни разу не конфигурировали (GET до первого
    // PUT) — вызывающая сторона трактует это как «конфигурации нет», а не
    // как ошибку (тот же приём, что AccountingPeriod.findByDirectionAndPeriod).
    findByDirection(
        direction: AccountingDirection,
    ): Promise<ErpCashConfig | null>;

    // Upsert по direction — единственная точка записи, покрывает и первый
    // PUT (записи ещё не было), и повторную правку существующей.
    save(entity: ErpCashConfig): Promise<void>;
}

export const ERP_CASH_CONFIG_REPOSITORY = Symbol('ERP_CASH_CONFIG_REPOSITORY');
