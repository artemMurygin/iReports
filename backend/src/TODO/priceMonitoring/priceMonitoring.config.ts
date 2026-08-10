import { CategoryKey } from './priceMonitoring.types';

// ─── XLSX: названия листов ────────────────────────────────────────────────────

/** Лист с iPhone и Watch */
export const SHEET_IPHONE_WATCH = 'Apple(iPhone, Watch)';

/** Лист с iPad и MacBook */
export const SHEET_IPAD_MACBOOK = 'Apple (iPad, Macbook)';

/** Паттерны для фильтрации строк листа iPad/MacBook */
export const IPAD_MACBOOK_PATTERNS: RegExp[] = [
    /macbook/i,
    /\bneo\b/i,
    /\bair\b/i,
    /ipad/i,
    /iPro/i,
];

// ─── Google Sheets ────────────────────────────────────────────────────────────

/** ID гугл-таблицы с ценами магазина */
export const SPREADSHEET_ID = '1kuHPwbQ1LGlNPqBHNuKrVNhUpaOi62kB8uqw8KJu1EY';

/** GID листа с товарами (для получения имени листа) */
export const SHEET_GID = 2068051743;

// ─── AI ───────────────────────────────────────────────────────────────────────

/** Порог схожести эмбеддингов для автоматического сопоставления */
export const SIMILARITY_THRESHOLD = 0.95;

/** Модели для LLM-сопоставления (в порядке предпочтения) */
export const WORKER_MODELS = [
    'cx/gpt-5.4-mini',
    'cx/gpt-5.5-low',
    'cx/gpt-5.4',
] as const;

// ─── МойСклад: фильтры по папкам номенклатуры ────────────────────────────────

const PF = 'https://api.moysklad.ru/api/remap/1.2/entity/productfolder';

function folders(...ids: string[]): string {
    return ids.map((id) => `productFolder=${PF}/${id}`).join(';');
}

/** Фильтр assortment по категориям для МойСклад */
export const CATEGORY_MS_FILTER: Record<CategoryKey, string> = {
    iPhone: folders(
        '7dc681c5-767e-11ef-0a80-143f001341be',
        'dfabd620-992a-11f0-0a80-085200099667',
    ),
    MacBook: folders(
        '713fc4ef-1600-11f1-0a80-0935002fef59',
        '01339dd7-2e59-11f1-0a80-01ac00040a08',
        '10889b40-1605-11f1-0a80-07be002ff9d4',
    ),
    iPad: folders(
        '7ead5d1f-178e-11f1-0a80-00e70003ed80',
        '63859b8c-1ddf-11f1-0a80-1d770005812c',
        'a2a48cd9-1de0-11f1-0a80-19ed00051aed',
        'f31685c2-178b-11f1-0a80-1a7d00039581',
    ),
    Watch: folders(
        '3558b0ed-127e-11f1-0a80-093000012470',
        'dbc96962-127f-11f1-0a80-0fd100017323',
        '267c0bdf-127f-11f1-0a80-169000014358',
    ),
    AirPods: folders('9c05f947-af95-11ee-0a80-14a100098fef'),
};
