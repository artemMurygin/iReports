import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type {
    MoySkladPriceUpdateResult,
    MoySkladPriceUpdateTrigger,
} from '../../application/ports/moysklad-price-update-trigger.port';
import {
    N8N_PRICE_UPDATE_TIMEOUT_MS,
    N8N_PRICE_UPDATE_WEBHOOKS,
} from '../config/pricing.config';

// Два PATCH-запроса к вебхукам n8n подряд (порядок — как в конфиге). Второй вызывается, даже если
// первый упал: цены продажи и розничные цены обновляются независимыми workflow. Итог возвращается
// по каждому вебхуку отдельно. Ответ не из диапазона 2xx (или таймаут) — неуспех.
// spec: shop/price-import-schedule#обновление-цен-в-моём-складе-через-n8n
@Injectable()
export class N8nMoySkladPriceUpdateTrigger implements MoySkladPriceUpdateTrigger {
    private readonly logger = new Logger(N8nMoySkladPriceUpdateTrigger.name);

    async triggerPriceUpdate(): Promise<MoySkladPriceUpdateResult> {
        const result = { uploadSale: false, uploadRc: false };
        for (const { target, url } of N8N_PRICE_UPDATE_WEBHOOKS) {
            try {
                const response = await axios.patch(url, undefined, {
                    timeout: N8N_PRICE_UPDATE_TIMEOUT_MS,
                });
                result[target] = true;
                this.logger.log(
                    `n8n: PATCH ${url} выполнен (HTTP ${(response as { status?: number } | undefined)?.status ?? '?'})`,
                );
            } catch (error) {
                this.logger.error(
                    `n8n: PATCH ${url} не удался: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
        return result;
    }
}
