import { RecalculateAccountingPeriodHandler } from './recalculate-accounting-period.handler';
import { RecalculateAccountingPeriodCommand } from './recalculate-accounting-period.command';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import { PeriodAlreadyClosedException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('RecalculateAccountingPeriodHandler', () => {
    const buildHandler = (period: AccountingPeriod | null) => {
        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod: jest.fn().mockResolvedValue(period),
            save: jest.fn(),
        };
        const deleteByPeriod = jest.fn().mockResolvedValue(undefined);
        const cacheRepo: AccountingCalculationCachePort = {
            find: jest.fn(),
            upsert: jest.fn(),
            deleteByDirectionAndPeriod: deleteByPeriod,
        };
        const handler = new RecalculateAccountingPeriodHandler(
            periodRepo,
            cacheRepo,
        );
        return { handler, deleteByPeriod };
    };

    it('на открытом периоде сбрасывает кэш', async () => {
        const { handler, deleteByPeriod } = buildHandler(null);

        await withRequestContext(() =>
            handler.execute(
                new RecalculateAccountingPeriodCommand({
                    direction: 'service',
                    period: '2026-08',
                }),
            ),
        );

        expect(deleteByPeriod).toHaveBeenCalledWith('service', '2026-08');
    });

    it('на закрытом периоде отклоняется', async () => {
        const closed = withRequestContext(() => {
            const period = AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-08',
            });
            period.close(1, 0);
            return period;
        });
        const { handler, deleteByPeriod } = buildHandler(closed);

        await withRequestContext(async () => {
            await expect(
                handler.execute(
                    new RecalculateAccountingPeriodCommand({
                        direction: 'service',
                        period: '2026-08',
                    }),
                ),
            ).rejects.toThrow(PeriodAlreadyClosedException);
        });
        expect(deleteByPeriod).not.toHaveBeenCalled();
    });
});
