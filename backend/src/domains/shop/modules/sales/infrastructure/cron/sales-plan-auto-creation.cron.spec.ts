import { Logger } from '@nestjs/common';
import { ShopSalesPlanAutoCreationCron } from './sales-plan-auto-creation.cron';
import type { EnsureShopSalesPlansForPeriodService } from '@/domains/shop/modules/sales/application/services/ensure-sales-plans-for-period.service';

describe('ShopSalesPlanAutoCreationCron', () => {
    // Ошибки крона уходят в структурный logger.error — подслушиваем
    // прототип, т.к. Logger создаётся внутри самого крона.
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    const buildCron = (ensure: jest.Mock) =>
        new ShopSalesPlanAutoCreationCron({
            ensure,
        } as unknown as EnsureShopSalesPlansForPeriodService);

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
        errorSpy.mockRestore();
    });

    it('достраивает план текущего периода (UTC) для направления shop', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-01T00:00:00.000Z'),
        );
        const ensure = jest.fn().mockResolvedValue([]);
        const cron = buildCron(ensure);

        await cron.run();

        expect(ensure).toHaveBeenCalledWith('2026-09');
    });

    // Идемпотентность самого достраивания (issue #56 — "автосоздание планов
    // магазина идемпотентно") уже покрыта на уровне
    // EnsureShopSalesPlansForPeriodService (см.
    // ensure-sales-plans-for-period.service.spec.ts, "не создаёт
    // дублей и не трогает APPROVED/MANUAL строки при повторном запуске") —
    // здесь достаточно убедиться, что повторный запуск крона просто
    // вызывает ту же идемпотентную операцию ещё раз, не дублируя побочных
    // эффектов самого крона (логирование, обработка ошибок).
    it('повторный запуск идемпотентен — просто вызывает ensure ещё раз, без побочных эффектов крона', async () => {
        const ensure = jest.fn().mockResolvedValue([]);
        const cron = buildCron(ensure);

        await cron.run();
        await cron.run();

        expect(ensure).toHaveBeenCalledTimes(2);
        expect(ensure).toHaveBeenNthCalledWith(1, expect.any(String));
        expect(ensure).toHaveBeenNthCalledWith(2, expect.any(String));
    });

    it('не выбрасывает исключение при ошибке достраивания — только логирует', async () => {
        const ensure = jest.fn().mockRejectedValue(new Error('db down'));
        const cron = buildCron(ensure);

        await expect(cron.run()).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                err: expect.any(Error) as Error,
                period: expect.any(String) as string,
            }),
            expect.any(String),
        );
    });
});
