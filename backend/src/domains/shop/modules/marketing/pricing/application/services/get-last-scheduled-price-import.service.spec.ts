import { GetLastScheduledPriceImportService } from './get-last-scheduled-price-import.service';

describe('GetLastScheduledPriceImportService', () => {
    // spec: shop/price-import-schedule#время-последней-автоматической-выгрузки
    it('возвращает { run: null }, если автовыгрузок ещё не было', async () => {
        const service = new GetLastScheduledPriceImportService({
            save: jest.fn(),
            get: jest.fn().mockResolvedValue(null),
        });
        await expect(service.execute()).resolves.toEqual({ run: null });
    });

    it('возвращает сохранённый запуск', async () => {
        const run = { status: 'success' as const, finishedAt: 123 };
        const service = new GetLastScheduledPriceImportService({
            save: jest.fn(),
            get: jest.fn().mockResolvedValue(run),
        });
        await expect(service.execute()).resolves.toEqual({ run });
    });
});
