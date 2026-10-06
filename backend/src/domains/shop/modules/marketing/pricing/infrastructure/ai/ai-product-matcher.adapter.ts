import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '@/integrations/ai/ai.service';
import type {
    CatalogItem,
    ProductMatcher,
} from '../../application/ports/product-matcher.port';
import type {
    CategoryKey,
    PriceListRow,
} from '../../domain/services/row-categorization.service';
import { ProductMatch } from '../../domain/value-objects/product-match.value-object';
import {
    AiMatchItem,
    buildFormatNamesPrompt,
    buildMatchingPrompt,
    parseFormatNamesResponse,
    parseMatchingResponse,
} from './pricing-ai-prompts';

function normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toNumberOrNull(value: string | number | null): number | null {
    if (value == null) return null;
    const n = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(n) ? n : null;
}

// Реализация PRODUCT_MATCHER поверх существующего AiService (Фаза 9) — перенос легаси
// PriceMonitoringService.matchAllCategories/formatNamesViaAi
// (src/TODO/priceMonitoring/priceMonitoring.service.ts), промпты — из pricing-ai-prompts.ts (порт
// priceMonitoring.prompts.ts). В отличие от легаси, здесь нет собственного Promise.allSettled по
// категориям — устойчивость "одна категория упала, остальные досчитались" теперь ответственность
// вызывающего пайплайна (StartPriceImportHandler), а не адаптера: адаптер один раз мапит один
// AI-запрос в доменный результат или бросает исключение.
@Injectable()
export class AiProductMatcherAdapter implements ProductMatcher {
    private readonly logger = new Logger(AiProductMatcherAdapter.name);

    constructor(private readonly ai: AiService) {}

    async match(
        category: CategoryKey,
        priceRows: PriceListRow[],
        catalogItems: CatalogItem[],
        signal?: AbortSignal,
    ): Promise<ProductMatch[]> {
        const prompt = buildMatchingPrompt(category, priceRows, catalogItems);
        this.logger.log(
            `[${category}] Запрос AI-сопоставления: прайс ${priceRows.length} строк, номенклатура ${catalogItems.length} товаров, длина промпта ${prompt.length} символов`,
        );

        const raw = await this.ai.ask(prompt, {
            temperature: 0,
            maxTokens: 30000,
            stream: true,
            headers: { 'X-OmniRoute-No-Cache': 'true' },
            signal,
        });
        this.logger.log(
            `[${category}] Ответ AI получен: ${raw.length} символов`,
        );

        const items = parseMatchingResponse(raw);
        if (items === null) {
            this.logger.error(
                `[${category}] Не удалось распарсить ответ AI-сопоставления как JSON-массив, первые 500 символов ответа: ${raw.slice(0, 500)}`,
            );
            throw new Error(
                `[${category}] Не удалось распарсить ответ AI-сопоставления`,
            );
        }

        const dropped = items.filter(
            (item) =>
                !item.system_id?.trim() ||
                !item.system_name?.trim() ||
                !item.price_name?.trim(),
        );
        if (dropped.length > 0) {
            this.logger.warn(
                `[${category}] AI вернул ${dropped.length} позиций без полной пары (не попадут ни в CostChange, ни в результат — эффективно нет сопоставления): ${JSON.stringify(dropped)}`,
            );
        }

        const fullPairs = items.filter(
            (
                item,
            ): item is AiMatchItem & {
                system_id: string;
                system_name: string;
                price_name: string;
            } =>
                !!item.system_id?.trim() &&
                !!item.system_name?.trim() &&
                !!item.price_name?.trim(),
        );

        // LLM иногда искажает UUID товара (подставляет сегмент из соседнего id в промпте) — такой
        // id в МойСклад не существует, и один он роняет весь атомарный батч обновления
        // (`POST /entity/product` -> 404 "Объект с типом 'product' ... не найден", 06.10.2026).
        // Поэтому id из ответа принимается только если он есть в переданном каталоге; иначе товар
        // ищется по точному названию (его модель копирует без искажений), а при неудаче позиция
        // отбрасывается с предупреждением в лог.
        const catalogIds = new Set(catalogItems.map((item) => item.id));
        const catalogByName = new Map<string, CatalogItem>();
        for (const item of catalogItems) {
            const key = normalizeName(item.name);
            if (!catalogByName.has(key)) catalogByName.set(key, item);
        }

        const matches: ProductMatch[] = [];
        const recoveredByName: string[] = [];
        const rejected: string[] = [];
        for (const item of fullPairs) {
            const aiId = item.system_id.trim();
            let productId: string;
            let productName: string;
            if (catalogIds.has(aiId)) {
                productId = aiId;
                productName = item.system_name;
            } else {
                const byName = catalogByName.get(
                    normalizeName(item.system_name),
                );
                if (!byName) {
                    rejected.push(
                        `"${item.price_name}" -> [${aiId}] "${item.system_name}"`,
                    );
                    continue;
                }
                productId = byName.id;
                productName = byName.name;
                recoveredByName.push(
                    `"${item.price_name}" -> [${aiId} => ${byName.id}] "${byName.name}"`,
                );
            }
            matches.push(
                ProductMatch.create({
                    sourceRowName: item.price_name,
                    sourcePrice: toNumberOrNull(item.price),
                    matchedProductId: productId,
                    matchedProductName: productName,
                    method: 'llm',
                    // Уверенность модель не возвращает — единственный уровень доверия у
                    // LLM-сопоставления в этой реализации: "AI вернул полную пару", см. комментарий
                    // выше про отличие от легаси.
                    confidence: 1,
                }),
            );
        }
        if (recoveredByName.length > 0) {
            this.logger.warn(
                `[${category}] AI вернул несуществующий id товара, товар восстановлен по точному названию (${recoveredByName.length}): ${recoveredByName.join('; ')}`,
            );
        }
        if (rejected.length > 0) {
            this.logger.warn(
                `[${category}] Отброшены позиции с несуществующим id товара, которые не удалось найти в каталоге и по названию — цена для них не обновится (${rejected.length}): ${rejected.join('; ')}`,
            );
        }

        // Строки прайса/номенклатуры, которых нет ни в одном ProductMatch — AI либо вообще не
        // упомянул их в ответе, либо упомянул без полной пары (см. `dropped` выше). Диагностика для
        // "товар есть и в прайсе, и в МойСклад, но цена не проставляется".
        const matchedSourceNames = new Set(
            matches.map((m) => m.getSourceRowName().trim().toLowerCase()),
        );
        const missingFromPriceList = priceRows.filter(
            (row) => !matchedSourceNames.has(row.name.trim().toLowerCase()),
        );
        if (missingFromPriceList.length > 0) {
            this.logger.warn(
                `[${category}] Строки прайса без сопоставления в ответе AI (${missingFromPriceList.length}): ${missingFromPriceList
                    .map((r) => `"${r.name}"`)
                    .join(', ')}`,
            );
        }

        const matchedProductIds = new Set(
            matches.map((m) => m.getMatchedProductId()),
        );
        const missingFromCatalog = catalogItems.filter(
            (item) => !matchedProductIds.has(item.id),
        );
        if (missingFromCatalog.length > 0) {
            this.logger.warn(
                `[${category}] Товары номенклатуры МойСклад без сопоставления в ответе AI (${missingFromCatalog.length}): ${missingFromCatalog
                    .map((i) => `[${i.id}] "${i.name}"`)
                    .join(', ')}`,
            );
        }

        this.logger.log(
            `[${category}] Сопоставлено: ${matches.length} позиций из ${items.length} в ответе AI`,
        );
        return matches;
    }

    async formatProductNames(
        names: string[],
        signal?: AbortSignal,
    ): Promise<string[]> {
        if (names.length === 0) return [];

        const prompt = buildFormatNamesPrompt(names);
        const response = await this.ai.ask(prompt, {
            temperature: 0,
            signal,
        });
        return parseFormatNamesResponse(response, names);
    }
}
