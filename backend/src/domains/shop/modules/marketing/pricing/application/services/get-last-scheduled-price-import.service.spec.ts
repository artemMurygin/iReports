import type { LastScheduledImportStore } from '../ports/last-scheduled-import-store.port';
import { GetLastScheduledPriceImportService } from './get-last-scheduled-price-import.service';

function fakeStore(
    run: { status: 'success' | 'error'; finishedAt: number } | null,
    priceUpdates = { uploadRc: null, uploadSale: null } as {
        uploadRc: { status: 'success' | 'error'; finishedAt: number } | null;
        uploadSale: { status: 'success' | 'error'; finishedAt: number } | null;
    },
): LastScheduledImportStore {
    return {
        save: jest.fn(),
        get: jest.fn().mockResolvedValue(run),
        savePriceUpdate: jest.fn(),
        getPriceUpdates: jest.fn().mockResolvedValue(priceUpdates),
    };
}

describe('GetLastScheduledPriceImportService', () => {
    // spec: shop/price-import-schedule#время-последней-автоматической-выгрузки
    it('возвращает пустой ответ, если автовыгрузок ещё не было', async () => {
        const service = new GetLastScheduledPriceImportService(fakeStore(null));
        await expect(service.execute()).resolves.toEqual({
            run: null,
            priceUpdates: { uploadRc: null, uploadSale: null },
        });
    });

    it('возвращает выгрузку прайса и результаты обновления цен в МойСклад', async () => {
        const run = { status: 'success' as const, finishedAt: 123 };
        const uploadRc = { status: 'success' as const, finishedAt: 130 };
        const uploadSale = { status: 'error' as const, finishedAt: 125 };
        const service = new GetLastScheduledPriceImportService(
            fakeStore(run, { uploadRc, uploadSale }),
        );
        await expect(service.execute()).resolves.toEqual({
            run,
            priceUpdates: { uploadRc, uploadSale },
        });
    });
});
