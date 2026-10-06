/**
 * Запуск обновления цен в МойСклад (n8n) после выгрузки прайса в таблицу переоценки.
 * spec: shop/price-import-schedule#обновление-цен-в-моём-складе-через-n8n
 */
export interface MoySkladPriceUpdateTrigger {
    /** @throws Error если хотя бы один из запросов не удался */
    triggerPriceUpdate(): Promise<void>;
}

export const MOYSKLAD_PRICE_UPDATE_TRIGGER = Symbol(
    'MOYSKLAD_PRICE_UPDATE_TRIGGER',
);
