import type { PriceUpdateTarget } from '../../infrastructure/config/pricing.config';

/** Результат по каждому вебхуку: `true` — n8n ответил успехом. */
export type MoySkladPriceUpdateResult = Record<PriceUpdateTarget, boolean>;

/**
 * Запуск обновления цен в МойСклад (n8n) после выгрузки прайса в таблицу переоценки. Не бросает
 * из-за ответа n8n: итог по каждому вебхуку возвращается в результате.
 * spec: shop/price-import-schedule#обновление-цен-в-моём-складе-через-n8n
 */
export interface MoySkladPriceUpdateTrigger {
    triggerPriceUpdate(): Promise<MoySkladPriceUpdateResult>;
}

export const MOYSKLAD_PRICE_UPDATE_TRIGGER = Symbol(
    'MOYSKLAD_PRICE_UPDATE_TRIGGER',
);
