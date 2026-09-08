import type {
    CategoryKey,
    PriceListRow,
} from '../../domain/services/row-categorization.service';
import type { CatalogItem } from '../../application/ports/product-matcher.port';

// Промпты AI-сопоставления/форматирования названий (Фаза 9, см. PRD раздел 3а: "AI-адаптер
// (промпты из priceMonitoring.prompts.ts — деталь реализации адаптера)") — verbatim-порт текста и
// правил сопоставления из src/TODO/priceMonitoring/priceMonitoring.prompts.ts, только типы
// заменены на доменные (`CategoryKey`/`PriceListRow` из RowCategorizationService, `CatalogItem` из
// PRODUCT_MATCHER). Формат ответа AI (JSON-массив), правила по каждой категории — не менялись,
// это тонкая деталь ai-product-matcher.adapter.ts, не переиспользуется вне него. Дублирующий
// инлайн-промпт из легаси `PriceMonitoringService.formatNamesViaAi`
// (priceMonitoring.service.ts:307-349) сюда намеренно не перенесён — используется только этот,
// канонический вариант (см. PRD, раздел 4, "мёртвый код при переносе").

function buildPriceList(rows: PriceListRow[]): string {
    return rows
        .map((item, idx) => `${idx + 1}. ${item.name} — ${item.price} руб.`)
        .join('\n');
}

function buildNomenclatureWithPrice(rows: CatalogItem[]): string {
    return rows
        .map(
            (item, idx) =>
                `${idx + 1}. [${item.id}] ${item.name}${item.price != null ? ` — РЦ ${item.price} руб.` : ''}`,
        )
        .join('\n');
}

function buildNomenclatureBasic(rows: CatalogItem[]): string {
    return rows
        .map((item, idx) => `${idx + 1}. [${item.id}] ${item.name}`)
        .join('\n');
}

const FORMAT_PRICE_TO_SYSTEM = `[
  {
    "price_name": "название из прайса",
    "system_id": "id из номенклатуры или null",
    "system_name": "название из номенклатуры или null",
    "price": 00000
  }
]`;

const FORMAT_SYSTEM_TO_PRICE = `[
  {
    "system_id": "id из номенклатуры",
    "system_name": "название из номенклатуры",
    "price_name": "название из прайса или null",
    "price": 00000
  }
]`;

const JSON_FOOTER = `Формат ответа: отправляй только JSON файл в формате ниже, не используй ничего дополнительно. Только чистый JSON`;

function buildIphonePrompt(priceList: string, nomenclature: string): string {
    return `Ты помогаешь сопоставить товары из прайс-листа с номенклатурой системы учёта.

Твоя задача: для каждого товара из прайса найти наиболее подходящий товар из номенклатуры и вернуть результат.

Правила сопоставления:
- Сопоставляй по модели, объёму памяти, цвету
- "1sim" и "nano SIM+eSIM" — одно и то же
- "eSIM" и "eSIM+eSIM" — одно и то же
- "eSIM + 1SIM" и "nano SIM+eSIM" — одно и то же
- Если подходящего товара нет — ставь null
- Верни ТОЛЬКО JSON массив, без пояснений и без markdown блоков

Прайс (название + цена):
${priceList}

Номенклатура (id + название):
${nomenclature}

${JSON_FOOTER}
${FORMAT_PRICE_TO_SYSTEM}`;
}

function buildMacbookPrompt(priceList: string, nomenclature: string): string {
    return `Ты помогаешь сопоставить товары из прайс-листа с номенклатурой системы учёта.

Твоя задача: для каждого товара из номенклатуры найти наиболее подходящий товар из прайса и вернуть его закупочную цену.

Правила сопоставления:
- Сопоставляй по модели, размеру экрана, объёму RAM, объёму SSD, цвету
- "полночный черный" = "Midnight", "голубой" = "Sky Blue", "серебристый" = "Silver", "сияющая звезда" = "Starlight"
- M4 (8 GPU) = базовый M4, M4 (10 GPU) = M4 с 10-ядерным GPU
- M5 10-Core GPU 8-Core = базовый M5, M5 10-Core GPU 10-Core = M5 с 10-ядерным GPU
- Если точного совпадения нет — найди наиболее близкий вариант по модели/памяти/цвету
- Если подходящего товара нет совсем — ставь null
- Верни ТОЛЬКО JSON массив, без пояснений и без markdown блоков

Номенклатура (id + название + текущая цена):
${nomenclature}

Прайс (название + закупочная цена):
${priceList}

${JSON_FOOTER}
${FORMAT_SYSTEM_TO_PRICE}`;
}

function buildIpadPrompt(priceList: string, nomenclature: string): string {
    return `Ты помогаешь сопоставить товары из прайс-листа с номенклатурой системы учёта.

Твоя задача: для каждого товара из номенклатуры найти наиболее подходящий товар из прайса и вернуть его закупочную цену.

Правила сопоставления:
- Сопоставляй по модели, размеру экрана, объёму памяти, цвету, типу подключения
- Wi-Fi+Cellular = LTE = 5G = eSIM — одно и то же
- "Space Gray" = "Grey" = "Gray" — одно и то же
- "Starlight" = "сияющая звезда" — одно и то же
- iPad Air 11" 2025 = iPad Air M3 2025
- iPad Air 13" 2025 = iPad Air M3 2025
- iPad Air 11" M4 2026 = iPad Air M4 2026
- iPad 2025 = iPad 11" 2025
- "iPro 11 M5" = "iPad Pro 11" 2025 M5"
- "iPro 13 M5" = "iPad Pro 13" 2025 M5"
- Если в прайсе несколько позиций с одинаковыми характеристиками — бери минимальную цену
- Если подходящего товара нет совсем — ставь null
- Верни ТОЛЬКО JSON массив, без пояснений и без markdown блоков

Номенклатура (id + название + текущая цена):
${nomenclature}

Прайс (название + закупочная цена):
${priceList}

${JSON_FOOTER}
${FORMAT_SYSTEM_TO_PRICE}`;
}

function buildWatchPrompt(priceList: string, nomenclature: string): string {
    return `Ты помогаешь сопоставить товары из прайс-листа с номенклатурой системы учёта.

Твоя задача: для каждого товара из номенклатуры найти наиболее подходящий товар из прайса и вернуть его закупочную цену.

Правила сопоставления:
- Сопоставляй по модели (SE 3, S11, Ultra 3), размеру корпуса (40/42/44/46/49mm), цвету корпуса, типу ремешка
- "розовое золото" = "Rose Gold"
- "черный" = "Jet Black" = "Black"
- "серебристый" = "Silver"
- "космический серый" = "Space Gray"
- "натуральный титан" = "Natural Titanium" = "Natural Ti"
- "черный титан" = "Black Titanium" = "Black Ti"
- "сияющая звезда" = "Starlight"
- "полночный черный" = "Midnight"
- Alpine Loop = Alp Lp
- Trail Loop = TL
- Ocean Band = OB
- Milanese Loop = Milanese
- Для S11 — если в прайсе несколько размеров ремешка (S/M и M/L) для одного цвета корпуса — бери минимальную цену
- Titanium версии S11 (Slate/Natural/Gold) — в прайсе нет, ставь null
- Если подходящего товара нет — ставь null
- Верни ТОЛЬКО JSON массив, без пояснений и без markdown блоков

Номенклатура (id + название + текущая цена):
${nomenclature}

Прайс (название + закупочная цена):
${priceList}

${JSON_FOOTER}
${FORMAT_SYSTEM_TO_PRICE}`;
}

function buildAirpodsPrompt(priceList: string, nomenclature: string): string {
    return `Ты помогаешь сопоставить товары из прайс-листа с номенклатурой системы учёта.

Твоя задача: для каждого товара из номенклатуры найди наиболее подходящий товар из прайса и верни его закупочную цену.

Правила сопоставления:
- AirPods Pro 2 (MQD83AM/A) = AirPods Pro 2 (Lightning) → соответствует "AirPods Pro 2"
- AirPods Pro 2 USB-C (MTJV3LL/A) = AirPods Pro 2 USB-C → соответствует "AirPods Pro 2"
- AirPods Pro 3 → соответствует "AirPods Pro 3"
- AirPods 4 (без ANC) → соответствует "AirPods 4"
- AirPods 4 ANC → соответствует "AirPods 4 ANC"
- AirPods Max (USB-C) 2024 по цветам:
  - голубой = Blue → "Airpods Max Blue 2024 USB-C"
  - темная ночь = Midnight → "Airpods Max Midnight 2024 USB-C"
  - сияющая звезда = Starlight → "Airpods Max Starlight 2024 USB-C"
  - оранжевый = Orange → "Airpods Max Orange 2024 USB-C"
  - фиолетовый = Purple → "Airpods Max Purple 2024 USB-C"
- Кейсы, отдельные наушники (L/R) — в прайсе нет, ставь null
- Верни ТОЛЬКО JSON массив, без пояснений и без markdown блоков

Номенклатура (id + название + текущая цена):
${nomenclature}

Прайс (название + закупочная цена):
${priceList}

${JSON_FOOTER}
${FORMAT_SYSTEM_TO_PRICE}`;
}

/** Строит промпт для LLM-сопоставления товаров по категории. */
export function buildMatchingPrompt(
    category: CategoryKey,
    priceRows: PriceListRow[],
    catalogItems: CatalogItem[],
): string {
    const priceList = buildPriceList(priceRows);

    switch (category) {
        case 'iPhone': {
            const nomenclature = buildNomenclatureBasic(catalogItems);
            return buildIphonePrompt(priceList, nomenclature);
        }
        case 'MacBook': {
            const nomenclature = buildNomenclatureWithPrice(catalogItems);
            return buildMacbookPrompt(priceList, nomenclature);
        }
        case 'iPad': {
            const nomenclature = buildNomenclatureWithPrice(catalogItems);
            return buildIpadPrompt(priceList, nomenclature);
        }
        case 'Watch': {
            const nomenclature = buildNomenclatureWithPrice(catalogItems);
            return buildWatchPrompt(priceList, nomenclature);
        }
        case 'AirPods': {
            const nomenclature = buildNomenclatureWithPrice(catalogItems);
            return buildAirpodsPrompt(priceList, nomenclature);
        }
    }
}

/** Одна позиция в raw JSON-ответе AI-сопоставления (оба направления). */
export interface AiMatchItem {
    system_id: string | null;
    system_name: string | null;
    price_name: string | null;
    price: string | number | null;
}

/**
 * Парсит raw JSON-ответ AI-сопоставления. Возвращает `null`, если ответ не распарсился как JSON-
 * массив (вызывающая сторона решает, что делать — в текущем адаптере это заканчивается `job.fail`).
 */
export function parseMatchingResponse(raw: string): AiMatchItem[] | null {
    let items: unknown;
    try {
        items = JSON.parse(raw.trim());
    } catch {
        return null;
    }
    return Array.isArray(items) ? (items as AiMatchItem[]) : null;
}

/** Строит промпт для приведения названий товаров Apple к единому стандартному формату. */
export function buildFormatNamesPrompt(names: string[]): string {
    return `Ты приводишь названия товаров Apple к единому стандартному формату.

  Правила форматирования:

  **MacBook:**
  Apple MacBook [Air/Pro/Neo] [13/14/15/16]" [Цвет] ([Процессор], [RAM]GB, [SSD])
  Пример: Apple MacBook Air 13" Midnight (M5, 16GB, 512GB)

  **iPad:**
  Apple iPad [Air/Pro/Mini/classic] [11/13]" [Цвет] [Wi-Fi/Wi-Fi+Cellular] [Память]GB ([Процессор], [Год])
  Пример: Apple iPad Air 11" Space Gray Wi-Fi 128GB (M4, 2026)

  **iPhone:**
  Apple iPhone [модель] [память]GB [Цвет] ([SIM-тип])
  Пример: Apple iPhone 16 Pro Max 256GB Desert Titanium (nano SIM+eSIM)

  **Apple Watch:**
  Apple Watch [серия] [размер]mm [Цвет корпуса] ([ремешок])
  Пример: Apple Watch Series 11 42mm Black (Sport Band Black)

  **AirPods:**
  Apple AirPods [модель] [цвет если есть]
  Пример: Apple AirPods Pro 3

  **iMac:**
  Apple iMac [Цвет] ([Процессор], [CPU-cores]/[GPU-cores], [RAM]GB, [SSD])
  Пример: Apple iMac Silver (M4, 8-Core CPU/8-Core GPU, 16GB, 256GB)

  **Аксессуары (Pencil, Keyboard, Mouse, Trackpad, Display):**
  Apple [название аксессуара] [цвет если есть]
  Пример: Apple Pencil Pro

  Отформатируй следующие названия. Верни ТОЛЬКО JSON-массив строк в том же порядке, без пояснений и markdown:
  ${JSON.stringify(names)}`;
}

/** Парсит JSON-ответ AI со списком отформатированных названий; при ошибке — исходные названия. */
export function parseFormatNamesResponse(
    response: string,
    fallbackNames: string[],
): string[] {
    try {
        return JSON.parse(response.trim()) as string[];
    } catch {
        return fallbackNames;
    }
}
