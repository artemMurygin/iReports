import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { MoySkladPriceUpdateTrigger } from '../../application/ports/moysklad-price-update-trigger.port';
import {
    N8N_PRICE_UPDATE_TIMEOUT_MS,
    N8N_PRICE_UPDATE_WEBHOOK_URLS,
} from '../config/pricing.config';

// Два PATCH-запроса к вебхукам n8n подряд (порядок — как в конфиге). Второй вызывается, даже если
// первый упал: цены продажи и закупочные цены обновляются независимыми workflow. Итог — ошибка,
// если упал хотя бы один.
// spec: shop/price-import-schedule#обновление-цен-в-моём-складе-через-n8n
@Injectable()
export class N8nMoySkladPriceUpdateTrigger implements MoySkladPriceUpdateTrigger {
    private readonly logger = new Logger(N8nMoySkladPriceUpdateTrigger.name);

    async triggerPriceUpdate(): Promise<void> {
        const failed: string[] = [];
        for (const url of N8N_PRICE_UPDATE_WEBHOOK_URLS) {
            try {
                await axios.patch(url, undefined, {
                    timeout: N8N_PRICE_UPDATE_TIMEOUT_MS,
                });
                this.logger.log(`n8n: PATCH ${url} выполнен`);
            } catch (error) {
                failed.push(url);
                this.logger.error(
                    `n8n: PATCH ${url} не удался: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
        if (failed.length > 0) {
            throw new Error(
                `Не удалось вызвать вебхуки n8n (${failed.length} из ${N8N_PRICE_UPDATE_WEBHOOK_URLS.length})`,
            );
        }
    }
}
