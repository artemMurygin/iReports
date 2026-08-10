export type ProductRow = {
    name: string;
    price: string | number | null;
};

export type CategoryKey = 'iPhone' | 'MacBook' | 'Watch' | 'iPad' | 'AirPods';

export type MoySkladRow = {
    id: string;
    name: string;
    /** Текущая розничная цена (РЦ) из МойСклад. Нужна для MacBook / iPad / Watch / AirPods. */
    price?: number | string | null;
};

export type CategoryGroup = {
    category: CategoryKey;
    priceRows: ProductRow[];
    moySkladCatalogRows: MoySkladRow[];
};

export type MatchedProduct = {
    externalId: string;
    moyskladName: string;
    priceListName: string;
    price: string | number | null;
    matchedVia: 'embedding' | 'llm';
};

export type VectorCandidate = {
    externalId: string;
    name: string;
    similarity: number;
};

export type JobProgressEvent = {
    step: string;
    message: string;
    status: 'progress' | 'done' | 'error';
};

/** Одна позиция в raw JSON-ответе AI (оба направления сопоставления) */
export type AiMatchItem = {
    system_id: string | null;
    system_name: string | null;
    price_name: string | null;
    price: string | number | null;
};
