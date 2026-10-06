/**
 * Уведомления о результате автоматической выгрузки прайса. Методы не бросают исключений
 * (сбой доставки логируется внутри) — spec: shop/price-import-schedule#отказоустойчивость-уведомлений
 */
export interface PriceImportNotifier {
    /** spec: shop/price-import-schedule#уведомление-об-успешной-выгрузке */
    notifyUploaded(): Promise<void>;

    /** spec: shop/price-import-schedule#уведомление-что-прайс-не-изменился */
    notifyUnchanged(): Promise<void>;

    /** spec: shop/price-import-schedule#уведомление-об-ошибке */
    notifyFailed(): Promise<void>;

    /**
     * Прайс записан в таблицу переоценки, но обновить цены в МойСклад (n8n) не удалось.
     * spec: shop/price-import-schedule#обновление-цен-в-моём-складе-через-n8n
     */
    notifyPriceUpdateFailed(): Promise<void>;

    /**
     * Ручная выгрузка (из сайдбара) завершилась: прайс выгружен в переоценку.
     * spec: shop/price-import-schedule#уведомления-о-ручной-выгрузке
     */
    notifyManualUploaded(): Promise<void>;

    /** Ручная выгрузка завершилась ошибкой. spec: shop/price-import-schedule#уведомления-о-ручной-выгрузке */
    notifyManualFailed(): Promise<void>;
}

export const PRICE_IMPORT_NOTIFIER = Symbol('PRICE_IMPORT_NOTIFIER');
