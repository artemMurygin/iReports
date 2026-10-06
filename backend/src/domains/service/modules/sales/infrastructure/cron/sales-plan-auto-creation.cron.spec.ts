import { Logger } from '@nestjs/common';
import { SalesPlanAutoCreationCron } from './sales-plan-auto-creation.cron';
import type { EnsureSalesPlansForPeriodService } from '../../application/services/ensure-sales-plans-for-period.service';

describe('SalesPlanAutoCreationCron', () => {
    // Ошибки крона уходят в структурный logger.error — подслушиваем
    // прототип, т.к. Logger создаётся внутри самого крона.
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    const buildCron = (ensure: jest.Mock) =>
        new SalesPlanAutoCreationCron({
            ensure,
        } as unknown as EnsureSalesPlansForPeriodService);

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
        errorSpy.mockRestore();
    });

    it('достраивает план текущего периода (UTC) для направления service', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-01T00:00:00.000Z'),
        );
        const ensure = jest.fn().mockResolvedValue([]);
        const cron = buildCron(ensure);

        await cron.run();

        expect(ensure).toHaveBeenCalledWith('service', '2026-09');
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
