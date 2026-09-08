import type { CostChange } from '../../domain/value-objects/cost-change.value-object';
import {
    MOYSKLAD_BUY_DATE_ATTRIBUTE_HREF,
    MOYSKLAD_CURRENCY_HREF,
    moyskladProductHref,
} from '../config/pricing.config';

// Перенос легаси `PriceMonitoringService.buildMoySkladUpdates`
// (src/TODO/priceMonitoring/priceMonitoring.service.ts) — сборка payload'а батч-обновления товаров
// МойСклад из доменных CostChange. Фильтр "есть цена и есть сопоставленный товар" здесь больше не
// нужен (легаси фильтровал `item.price != null && item.externalId != null`): CostChange создаётся
// в StartPriceImportHandler только для уже сопоставленных позиций с известной новой ценой — сюда
// всегда приходят валидные изменения.
export function buildMoySkladProductUpdates(
    costChanges: CostChange[],
): object[] {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 00:00:00`;

    return costChanges.map((change) => ({
        name: change.getProductName(),
        meta: {
            href: moyskladProductHref(change.getProductId()),
            type: 'product',
            mediaType: 'application/json',
        },
        buyPrice: {
            value: Math.round(change.getNewCost() * 100) || 0,
            currency: {
                meta: {
                    href: MOYSKLAD_CURRENCY_HREF,
                    type: 'currency',
                    mediaType: 'application/json',
                },
            },
        },
        attributes: [
            {
                meta: {
                    href: MOYSKLAD_BUY_DATE_ATTRIBUTE_HREF,
                    type: 'attributemetadata',
                    mediaType: 'application/json',
                },
                value: today,
            },
        ],
    }));
}
