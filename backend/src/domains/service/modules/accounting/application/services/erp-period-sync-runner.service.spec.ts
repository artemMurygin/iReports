import { ErpPeriodSyncRunner } from './erp-period-sync-runner.service';
import { ErpSyncFailedException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { Period } from '@/shared/domain/period.value-object';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('ErpPeriodSyncRunner', () => {
    const period = Period.create('2026-07');

    it('успешный синк — резолвится, ошибок нет', async () => {
        const syncPeriod = jest.fn().mockResolvedValue(undefined);
        const runner = new ErpPeriodSyncRunner({ syncPeriod });

        await expect(runner.run('service', period)).resolves.toBeUndefined();
        expect(syncPeriod).toHaveBeenCalledWith(period);
    });

    it('ошибка интеграции → ErpSyncFailedException (409) с причиной в metadata', async () => {
        const runner = new ErpPeriodSyncRunner({
            syncPeriod: jest.fn().mockRejectedValue(new Error('timeout 502')),
        });

        const error = await withRequestContext(() =>
            runner.run('shop', period).catch((e: unknown) => e),
        );
        expect(error).toBeInstanceOf(ErpSyncFailedException);
        expect((error as ErpSyncFailedException).metadata).toEqual({
            direction: 'shop',
            period: '2026-07',
            reason: 'timeout 502',
        });
    });

    it('таймаут синка → ErpSyncFailedException, не дожидаясь завершения синка', async () => {
        jest.useFakeTimers();
        try {
            const never = new Promise<void>(() => undefined);
            const runner = new ErpPeriodSyncRunner({
                syncPeriod: jest.fn().mockReturnValue(never),
            });

            const pending = withRequestContext(() =>
                runner
                    .run('service', period, { timeoutMs: 1000 })
                    .catch((e: unknown) => e),
            );
            await jest.advanceTimersByTimeAsync(1001);

            await expect(pending).resolves.toBeInstanceOf(
                ErpSyncFailedException,
            );
        } finally {
            jest.useRealTimers();
        }
    });
});
