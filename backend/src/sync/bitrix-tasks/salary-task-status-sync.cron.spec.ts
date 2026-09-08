// logCronError пишет в файл на диске — мокаем (см. сестринский
// sales-plan-auto-creation.cron.spec.ts).
jest.mock('@/shared/cron/cron-file-logger', () => ({
    logCronError: jest.fn(),
}));

import { SalaryTaskStatusSyncCron } from './salary-task-status-sync.cron';
import { logCronError } from '@/shared/cron/cron-file-logger';
import type { SalaryTaskStatusSyncService } from './salary-task-status-sync.service';

// Раздел 8 tasks.md: крон — тонкая обёртка над SalaryTaskStatusSyncService,
// по образцу SalesPlanAutoCreationCron — открывает RequestContext вручную
// (крон выполняется вне HTTP-запроса) и не пробрасывает исключение наружу.
describe('SalaryTaskStatusSyncCron', () => {
    const buildCron = (run: jest.Mock) =>
        new SalaryTaskStatusSyncCron({
            run,
        } as unknown as SalaryTaskStatusSyncService);

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('вызывает SalaryTaskStatusSyncService.run()', async () => {
        const run = jest.fn().mockResolvedValue(undefined);
        const cron = buildCron(run);

        await cron.run();

        expect(run).toHaveBeenCalledTimes(1);
    });

    it('не выбрасывает исключение, если run() падает — только логирует', async () => {
        const run = jest.fn().mockRejectedValue(new Error('unexpected'));
        const cron = buildCron(run);

        await expect(cron.run()).resolves.toBeUndefined();
        expect(logCronError).toHaveBeenCalledWith(
            'SalaryTaskStatusSyncCron.run',
            expect.any(Error),
        );
    });
});
