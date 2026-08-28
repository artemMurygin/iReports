import { ShopAccountingPeriod } from '@/domains/shop/modules/accounting/domain/entities/shop-accounting-period.entity';

// Зеркало domains/service/modules/accounting/application/ports/
// accounting-period.port.ts (Фаза 5 docs/service-shop-boundary-violations-fix)
// — независимый порт для направления shop, без параметра direction: он
// зафиксирован реализацией (см. ShopAccountingPeriodRepository).
export interface ShopAccountingPeriodRepositoryPort {
    // null — для этого периода ещё нет записи, вызывающая сторона
    // трактует это как OPEN (см. ShopAccountingPeriod, шапка комментария).
    findByPeriod(period: string): Promise<ShopAccountingPeriod | null>;

    // Upsert по period — единственная точка записи, покрывает и первое
    // закрытие (записи ещё не было), и повторное открытие/закрытие
    // существующей.
    save(entity: ShopAccountingPeriod): Promise<void>;
}

export const SHOP_ACCOUNTING_PERIOD_REPOSITORY = Symbol(
    'SHOP_ACCOUNTING_PERIOD_REPOSITORY',
);
