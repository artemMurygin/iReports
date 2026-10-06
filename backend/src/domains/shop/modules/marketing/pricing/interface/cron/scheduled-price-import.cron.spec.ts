import { RequestContext } from 'nestjs-request-context';
import { ScheduledPriceImportCron } from './scheduled-price-import.cron';
import { ScheduledImportOutcome } from '../../domain/value-objects/scheduled-import-outcome.value-object';

describe('ScheduledPriceImportCron', () => {
    it('запускает RunScheduledPriceImportService.run()', async () => {
        const service = { run: jest.fn().mockResolvedValue(ScheduledImportOutcome.uploaded()) };
        const cron = new ScheduledPriceImportCron(service as never);

        await cron.run();

        expect(service.run).toHaveBeenCalledTimes(1);
    });

    it('не бросает, если сервис отказал', async () => {
        const service = { run: jest.fn().mockRejectedValue(new Error('boom')) };
        const cron = new ScheduledPriceImportCron(service as never);

        await expect(cron.run()).resolves.toBeUndefined();
    });

    it('вызывает сервис внутри RequestContext', async () => {
        let ctx: unknown;
        const service = {
            run: jest.fn().mockImplementation(async () => {
                ctx = RequestContext.currentContext;
                return ScheduledImportOutcome.unchanged();
            }),
        };
        const cron = new ScheduledPriceImportCron(service as never);

        await cron.run();

        expect(ctx).toBeDefined();
    });
});
