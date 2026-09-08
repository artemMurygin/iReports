import type {
    CategoryKey,
    PriceListRow,
} from '../../domain/services/row-categorization.service';
import type { ProductMatch } from '../../domain/value-objects/product-match.value-object';

/** Позиция каталога МойСклад для конкретной категории — вход AI-сопоставления по одной категории. */
export interface CatalogItem {
    readonly id: string;
    readonly name: string;
    /** Текущая розничная цена (РЦ), если известна — используется промптами MacBook/iPad/Watch/AirPods. */
    readonly price?: number | string | null;
}

// Порт AI-сопоставления названий товаров (Фаза 9, см. PRD раздел 3а: "PRODUCT_MATCHER —
// AI-сопоставление названий") — прячет AiService и промпты
// src/TODO/priceMonitoring/priceMonitoring.prompts.ts за интерфейсом, который application-слой
// (StartPriceImportHandler) вызывает не зная про конкретную AI-модель/HTTP-транспорт.
export interface ProductMatcher {
    /**
     * Сопоставляет строки прайса одной категории с каталогом МойСклад той же категории. Возвращает
     * доменные ProductMatch — реализация решает, как трактовать отсутствие совпадения (в текущей
     * AI-реализации несопоставленные позиции ответом AI не возвращаются вовсе, см.
     * ai-product-matcher.adapter.ts).
     */
    match(
        category: CategoryKey,
        priceRows: PriceListRow[],
        catalogItems: CatalogItem[],
    ): Promise<ProductMatch[]>;

    /**
     * Приводит названия товаров (лист iPad/MacBook прайса) к единому стандартному формату перед
     * категоризацией/сопоставлением — перенос легаси `formatNamesViaAi`. Отдельный метод порта, а
     * не отдельный порт: тот же AI-транспорт, та же ответственность "текстовые AI-операции над
     * прайсом поставщика перед сопоставлением с каталогом".
     */
    formatProductNames(names: string[]): Promise<string[]>;
}

export const PRODUCT_MATCHER = Symbol('PRODUCT_MATCHER');
