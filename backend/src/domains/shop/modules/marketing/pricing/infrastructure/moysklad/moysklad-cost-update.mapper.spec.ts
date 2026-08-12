import { buildMoySkladProductUpdates } from './moysklad-cost-update.mapper';
import { CostChange } from '../../domain/value-objects/cost-change.value-object';
import {
    MOYSKLAD_BUY_DATE_ATTRIBUTE_HREF,
    MOYSKLAD_CURRENCY_HREF,
    moyskladProductHref,
} from '../config/pricing.config';

describe('buildMoySkladProductUpdates', () => {
    it('строит payload батч-обновления товара МойСклад из CostChange', () => {
        const change = CostChange.create({
            productId: 'ms-1',
            productName: 'Apple MacBook Air 13 Midnight',
            oldCost: null,
            newCost: 120000,
        });

        const [update] = buildMoySkladProductUpdates([change]) as Array<
            Record<string, unknown>
        >;

        expect(update.name).toBe('Apple MacBook Air 13 Midnight');
        expect((update.meta as { href: string }).href).toBe(
            moyskladProductHref('ms-1'),
        );
        expect((update.buyPrice as { value: number }).value).toBe(120000 * 100);
        expect(
            (update.buyPrice as { currency: { meta: { href: string } } })
                .currency.meta.href,
        ).toBe(MOYSKLAD_CURRENCY_HREF);
        const attributes = update.attributes as { meta: { href: string } }[];
        expect(attributes[0].meta.href).toBe(MOYSKLAD_BUY_DATE_ATTRIBUTE_HREF);
    });

    it('для нулевой цены пишет buyPrice.value = 0', () => {
        const change = CostChange.create({
            productId: 'ms-1',
            productName: 'Товар',
            oldCost: null,
            newCost: 0,
        });

        const [update] = buildMoySkladProductUpdates([change]) as Array<
            Record<string, unknown>
        >;

        expect((update.buyPrice as { value: number }).value).toBe(0);
    });
});
