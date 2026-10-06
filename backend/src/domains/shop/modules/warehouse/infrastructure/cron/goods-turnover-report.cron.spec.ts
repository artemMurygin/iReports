import { Logger } from '@nestjs/common';
import { GoodsTurnoverReportCron } from './goods-turnover-report.cron';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { RebuildGoodsTurnoverReportService } from '@/domains/shop/modules/warehouse/application/services/goods-turnover-report/rebuild-goods-turnover-report.service';

describe('GoodsTurnoverReportCron.run', () => {
    // Ошибки крона уходят в структурный logger.error — подслушиваем
    // прототип, т.к. Logger создаётся внутри самого крона.
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
        errorSpy.mockRestore();
    });

    const buildCron = (
        findByPeriod: jest.Mock,
        rebuild: jest.Mock = jest.fn().mockResolvedValue(undefined),
    ) =>
        new GoodsTurnoverReportCron(
            { rebuild } as unknown as RebuildGoodsTurnoverReportService,
            { findByPeriod } as unknown as ShopAccountingPeriodRepositoryPort,
        );

    it('пересчитывает текущий открытый месяц, если запись о периоде отсутствует (трактуется как OPEN)', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-15T00:00:00.000Z'),
        );
        const findByPeriod = jest.fn().mockResolvedValue(null);
        const rebuild = jest.fn().mockResolvedValue(undefined);
        const cron = buildCron(findByPeriod, rebuild);

        await cron.run();

        expect(findByPeriod).toHaveBeenCalledWith('2026-09');
        expect(rebuild).toHaveBeenCalledTimes(1);
        const [calledPeriod] = rebuild.mock.calls[0] as [
            { getValue(): string },
        ];
        expect(calledPeriod.getValue()).toBe('2026-09');
    });

    it('пересчитывает текущий месяц, если запись о периоде есть, но период открыт', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-15T00:00:00.000Z'),
        );
        const findByPeriod = jest
            .fn()
            .mockResolvedValue({ isClosed: () => false });
        const rebuild = jest.fn().mockResolvedValue(undefined);
        const cron = buildCron(findByPeriod, rebuild);

        await cron.run();

        expect(rebuild).toHaveBeenCalledTimes(1);
    });

    it('пропускает пересчёт, если период закрыт', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-15T00:00:00.000Z'),
        );
        const findByPeriod = jest
            .fn()
            .mockResolvedValue({ isClosed: () => true });
        const rebuild = jest.fn().mockResolvedValue(undefined);
        const cron = buildCron(findByPeriod, rebuild);

        await cron.run();

        expect(rebuild).not.toHaveBeenCalled();
    });

    it('не выбрасывает исключение при ошибке пересчёта — только логирует', async () => {
        const findByPeriod = jest.fn().mockResolvedValue(null);
        const rebuild = jest.fn().mockRejectedValue(new Error('db down'));
        const cron = buildCron(findByPeriod, rebuild);

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
