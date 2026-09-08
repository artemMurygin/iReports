// logCronError пишет в файл на диске (см. cron-file-logger.ts) — мокаем,
// чтобы юнит-тест не оставлял побочных файлов в репозитории (тот же приём,
// что и в sales-plan-auto-creation.cron.spec.ts).
jest.mock('@/shared/cron/cron-file-logger', () => ({
    logCronError: jest.fn(),
}));

import { GoodsTurnoverReportCron } from './goods-turnover-report.cron';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { RebuildGoodsTurnoverReportService } from '@/domains/shop/modules/warehouse/application/services/goods-turnover-report/rebuild-goods-turnover-report.service';
import { logCronError } from '@/shared/cron/cron-file-logger';

describe('GoodsTurnoverReportCron.run', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
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
        expect(logCronError).toHaveBeenCalledWith(
            'GoodsTurnoverReportCron.run',
            expect.any(Error),
            expect.objectContaining<{ period: string }>({
                period: expect.any(String) as string,
            }),
        );
    });
});
