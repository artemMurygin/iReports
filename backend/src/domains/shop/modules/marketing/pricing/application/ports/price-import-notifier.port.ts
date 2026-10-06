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
}

export const PRICE_IMPORT_NOTIFIER = Symbol('PRICE_IMPORT_NOTIFIER');
