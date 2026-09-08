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
    ): Promise<ProductMatch[]> {
        const prompt = buildMatchingPrompt(category, priceRows, catalogItems);

        const raw = await this.ai.ask(prompt, {
            temperature: 0,
            maxTokens: 30000,
            stream: true,
            headers: { 'X-OmniRoute-No-Cache': 'true' },
        });

        const items = parseMatchingResponse(raw);
        if (items === null) {
            throw new Error(
                `[${category}] Не удалось распарсить ответ AI-сопоставления`,
            );
        }

        const matches = items
            .filter(
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
            )
            .map((item) =>
                ProductMatch.create({
                    sourceRowName: item.price_name,
                    sourcePrice: toNumberOrNull(item.price),
                    matchedProductId: item.system_id,
                    matchedProductName: item.system_name,
                    method: 'llm',
                    // Уверенность модель не возвращает — единственный уровень доверия у
                    // LLM-сопоставления в этой реализации: "AI вернул полную пару", см. комментарий
                    // выше про отличие от легаси.
                    confidence: 1,
                }),
            );

        this.logger.log(
            `[${category}] Сопоставлено: ${matches.length} позиций из ${items.length} в ответе AI`,
        );
        return matches;
    }

    async formatProductNames(names: string[]): Promise<string[]> {
        if (names.length === 0) return [];

        const prompt = buildFormatNamesPrompt(names);
        const response = await this.ai.ask(prompt, { temperature: 0 });
        return parseFormatNamesResponse(response, names);
    }
}
