// logCronError пишет в файл на диске (см. cron-file-logger.ts) — мокаем,
// чтобы юнит-тест не оставлял побочных файлов в репозитории.
jest.mock('@/shared/cron/cron-file-logger', () => ({
    logCronError: jest.fn(),
}));

import { SalesPlanAutoCreationCron } from './sales-plan-auto-creation.cron';
import type { EnsureSalesPlansForPeriodService } from '../../application/services/ensure-sales-plans-for-period.service';
import { logCronError } from '@/shared/cron/cron-file-logger';

describe('SalesPlanAutoCreationCron', () => {
    const buildCron = (ensure: jest.Mock) =>
        new SalesPlanAutoCreationCron({
            ensure,
        } as unknown as EnsureSalesPlansForPeriodService);

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
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
        expect(logCronError).toHaveBeenCalledWith(
            'SalesPlanAutoCreationCron.run',
            expect.any(Error),
            expect.objectContaining({ period: expect.any(String) }),
        );
    });
});
