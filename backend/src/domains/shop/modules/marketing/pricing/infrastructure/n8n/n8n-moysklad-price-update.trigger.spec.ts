import axios from 'axios';
import { N8N_PRICE_UPDATE_WEBHOOKS } from '../config/pricing.config';
import { N8nMoySkladPriceUpdateTrigger } from './n8n-moysklad-price-update.trigger';

jest.mock('axios');
const patch = axios.patch as jest.Mock;

describe('N8nMoySkladPriceUpdateTrigger', () => {
    beforeEach(() => patch.mockReset());

    // spec: shop/price-import-schedule#обновление-цен-в-моём-складе-через-n8n
    it('шлёт PATCH на оба вебхука по порядку: сначала акционная РЦ, потом РЦ', async () => {
        patch.mockResolvedValue({ status: 200 });

        const result =
            await new N8nMoySkladPriceUpdateTrigger().triggerPriceUpdate();

        expect(patch.mock.calls.map((c) => c[0])).toEqual([
            'https://n8n.murygin.tech/webhook/updateSalePricesInMS',
            'https://n8n.murygin.tech/webhook/updatePricesInMS',
        ]);
        expect(N8N_PRICE_UPDATE_WEBHOOKS.map((w) => w.target)).toEqual([
            'uploadSale',
            'uploadRc',
        ]);
        expect(result).toEqual({ uploadSale: true, uploadRc: true });
    });

    it('сбой первого вебхука не мешает второму; результат — по каждому отдельно', async () => {
        patch.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce({});

        const result =
            await new N8nMoySkladPriceUpdateTrigger().triggerPriceUpdate();

        expect(patch).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ uploadSale: false, uploadRc: true });
    });

    it('сбой второго вебхука отражается только на нём', async () => {
        patch.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('404'));

        const result =
            await new N8nMoySkladPriceUpdateTrigger().triggerPriceUpdate();

        expect(result).toEqual({ uploadSale: true, uploadRc: false });
    });
});
