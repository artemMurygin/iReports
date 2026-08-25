import { ErpCashConfig } from '@/domains/service/modules/accounting/domain/entities/erp-cash-config.entity';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Конфигурация кассы направления (PRD 3, Фаза 11) — direction-агностичный
// порт, как AccountingPeriodRepositoryPort: физически определён в
// domains/service, domains/shop заводит собственный экземпляр реализации
// под тем же токеном (см. domains/service/CLAUDE.md, раздел про
// ACCOUNTING_PERIOD_REPOSITORY/BALANCE_TRANSACTION_REPOSITORY).
//
// Только чтение — начиная с правки пользователя от 2026-08-24 (см. заметку
// в конце Фазы 11 плана) конфигурация читается из файлового конфига модуля
// (env-переменные, domains/{service,shop}/modules/accounting/config/
// erp-cash.config.ts), а не из БД, и больше не редактируется через API:
// метод save() и PUT-эндпоинт убраны вместе с этим.
export interface ErpCashConfigRepositoryPort {
    // null — направление не сконфигурировано (env-переменные не заданы) —
    // вызывающая сторона трактует это как «конфигурации нет», а не как
    // ошибку (тот же приём, что AccountingPeriod.findByDirectionAndPeriod).
    findByDirection(
        direction: AccountingDirection,
    ): Promise<ErpCashConfig | null>;
}

export const ERP_CASH_CONFIG_REPOSITORY = Symbol('ERP_CASH_CONFIG_REPOSITORY');
