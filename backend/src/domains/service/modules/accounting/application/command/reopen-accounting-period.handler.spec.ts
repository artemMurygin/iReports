import { ReopenAccountingPeriodHandler } from './reopen-accounting-period.handler';
import { ReopenAccountingPeriodCommand } from './reopen-accounting-period.command';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { PeriodNotClosedException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('ReopenAccountingPeriodHandler', () => {
    const buildHandler = (period: AccountingPeriod | null) => {
        const save = jest.fn().mockResolvedValue(undefined);
        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod: jest.fn().mockResolvedValue(period),
            save,
        };
        const deleteSnapshot = jest.fn().mockResolvedValue(undefined);
        const snapshotRepo: AccountingPeriodSnapshotPort = {
            saveAll: jest.fn(),
            findByKey: jest.fn(),
            findManyByKey: jest.fn().mockResolvedValue(new Map()),
            deleteByDirectionAndPeriod: deleteSnapshot,
        };
        const unitOfWork: UnitOfWorkPort = { run: (work) => work() };
        const handler = new ReopenAccountingPeriodHandler(
            periodRepo,
            snapshotRepo,
            unitOfWork,
        );
        return { handler, save, deleteSnapshot };
    };

    it('открытый (никогда не закрывавшийся) период отклоняет повторное открытие', async () => {
        const { handler } = buildHandler(null);

        await withRequestContext(async () => {
            await expect(
                handler.execute(
                    new ReopenAccountingPeriodCommand({
                        direction: 'service',
                        period: '2026-08',
                    }),
                ),
            ).rejects.toThrow(PeriodNotClosedException);
        });
    });

    it('закрытый период открывается и снапшот удаляется целиком', async () => {
        const closed = withRequestContext(() => {
            const period = AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-08',
            });
            period.close(1, 0);
            return period;
        });
        const { handler, save, deleteSnapshot } = buildHandler(closed);

        const response = await withRequestContext(() =>
            handler.execute(
                new ReopenAccountingPeriodCommand({
                    direction: 'service',
                    period: '2026-08',
                }),
            ),
        );

        expect(response.status).toBe('OPEN');
        expect(response.closedBy).toBeNull();
        expect(save).toHaveBeenCalledTimes(1);
        expect(deleteSnapshot).toHaveBeenCalledWith('service', '2026-08');
    });
});
