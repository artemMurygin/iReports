import { ErpCashConfig } from '@/domains/service/modules/accounting/domain/entities/erp-cash-config.entity';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Конфигурация кассы направления service (PRD 3, Фаза 11) — до Фазы 4
// docs/service-shop-boundary-violations-fix был direction-агностичным
// портом, как AccountingPeriodRepositoryPort (domains/shop заводил
// собственный экземпляр реализации под тем же токеном). С этой фазы —
// собственный, только service, порт: у shop независимый
// ShopErpCashConfigRepositoryPort/SHOP_ERP_CASH_CONFIG_REPOSITORY (см.
// domains/shop/modules/accounting/application/ports/shop-erp-cash-config.port.ts).
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
