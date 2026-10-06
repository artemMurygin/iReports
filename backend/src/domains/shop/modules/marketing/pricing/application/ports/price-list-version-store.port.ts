/**
 * Хранилище названия последнего успешно выгруженного файла прайса.
 * spec: shop/price-import-schedule#выгрузка-только-при-изменении-прайса
 */
export interface PriceListVersionStore {
    /** `null`, если автоматических выгрузок ещё не было. */
    getLastUploadedName(): Promise<string | null>;

    saveUploadedName(name: string): Promise<void>;
}

export const PRICE_LIST_VERSION_STORE = Symbol('PRICE_LIST_VERSION_STORE');
