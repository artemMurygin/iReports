import type { PriceListFile } from '../../domain/value-objects/price-list-file.value-object';

/**
 * Источник прайс-листа (папка Google Drive).
 * spec: shop/price-import-schedule#источник-прайс-листа
 */
export interface PriceListSource {
    /**
     * Единственный файл папки.
     * @throws PriceListFileNotFoundException папка пуста
     * @throws PriceListFileAmbiguousException файлов больше одного
     */
    findPriceListFile(): Promise<PriceListFile>;

    /** Содержимое файла в формате XLSX (Google-таблица экспортируется). */
    download(file: PriceListFile): Promise<Buffer>;
}

export const PRICE_LIST_SOURCE = Symbol('PRICE_LIST_SOURCE');
