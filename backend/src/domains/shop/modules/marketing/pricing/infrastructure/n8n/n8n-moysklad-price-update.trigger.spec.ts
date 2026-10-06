import axios from 'axios';
import { N8N_PRICE_UPDATE_WEBHOOK_URLS } from '../config/pricing.config';
import { N8nMoySkladPriceUpdateTrigger } from './n8n-moysklad-price-update.trigger';

jest.mock('axios');
const patch = axios.patch as jest.Mock;

describe('N8nMoySkladPriceUpdateTrigger', () => {
    beforeEach(() => patch.mockReset());

    // spec: shop/price-import-schedule#обновление-цен-в-моём-складе-через-n8n
    it('шлёт PATCH на оба вебхука по порядку', async () => {
        patch.mockResolvedValue({ status: 200 });

        await new N8nMoySkladPriceUpdateTrigger().triggerPriceUpdate();

        expect(patch.mock.calls.map((c) => c[0])).toEqual(
            N8N_PRICE_UPDATE_WEBHOOK_URLS,
        );
        expect(N8N_PRICE_UPDATE_WEBHOOK_URLS).toEqual([
            'https://n8n.murygin.tech/webhook/updateSalePricesInMS',
            'https://n8n.murygin.tech/webhook/updatePricesInMS',
        ]);
    });

    it('второй вебхук вызывается, даже если первый упал, а в итоге бросает ошибку', async () => {
        patch.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce({});

        await expect(
            new N8nMoySkladPriceUpdateTrigger().triggerPriceUpdate(),
        ).rejects.toThrow(/n8n/i);
        expect(patch).toHaveBeenCalledTimes(2);
    });

    it('бросает ошибку, если упал второй вебхук', async () => {
        patch.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('404'));

        await expect(
            new N8nMoySkladPriceUpdateTrigger().triggerPriceUpdate(),
        ).rejects.toThrow(/n8n/i);
    });
});
