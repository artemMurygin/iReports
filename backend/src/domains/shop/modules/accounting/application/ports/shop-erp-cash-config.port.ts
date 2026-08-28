import { ShopErpCashConfig } from '@/domains/shop/modules/accounting/domain/entities/shop-erp-cash-config.entity';

// Конфигурация кассы МойСклада направления shop (PRD 3, Фаза 11) —
// собственный, независимый порт shop (Фаза 4
// docs/service-shop-boundary-violations-fix): до этой фазы
// MoyskladCashDocumentAdapter инжектил ERP_CASH_CONFIG_REPOSITORY/
// ErpCashConfigRepositoryPort напрямую из domains/service (тот же приём,
// что AccountingPeriodRepositoryPort) — обратное направление цикла
// Shop.moysklad-cash-document.adapter → Service.accounting (§2.2
// docs/service-shop-boundary-violations.md). Разорвано дублированием: свой
// класс/токен, не переиспользующий ErpCashConfig из domains/service.
//
// Только чтение — конфигурация читается из файлового конфига модуля
// (env-переменные, config/erp-cash.config.ts), а не из БД, и не
// редактируется через API.
export interface ShopErpCashConfigRepositoryPort {
    // null — направление не сконфигурировано (env-переменные не заданы) —
    // вызывающая сторона трактует это как «конфигурации нет», а не как
    // ошибку.
    findConfig(): Promise<ShopErpCashConfig | null>;
}

export const SHOP_ERP_CASH_CONFIG_REPOSITORY = Symbol(
    'SHOP_ERP_CASH_CONFIG_REPOSITORY',
);
