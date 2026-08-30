import { ReopenAccountingPeriodHandler } from './reopen-accounting-period.handler';
import { ReopenAccountingPeriodCommand } from './reopen-accounting-period.command';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { PeriodNotClosedException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { SalaryAccrualsNotDraftException } from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';

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
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const unitOfWork: UnitOfWorkPort = { run: (work) => work() };
        const handler = new ReopenAccountingPeriodHandler(
            periodRepo,
            snapshotRepo,
            accrualRepo,
            unitOfWork,
        );
        return { handler, save, deleteSnapshot, accrualRepo };
    };

    const buildClosedPeriod = () =>
        withRequestContext(() => {
            const period = AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-08',
            });
            period.close(1, 0);
            return period;
        });

    const buildAccrual = (employeeId: number) =>
        withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-08',
                employeeId,
                isDismissed: false,
                total: 100,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        amount: 100,
                        sources: [],
                    },
                ],
            }),
        );

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

    // PRD 1 docs/payroll-closing-and-accrual: переоткрытие удаляет документы
    // начисления вместе со снапшотом, пока все они DRAFT; иначе — 409 с
    // перечнем документов не в DRAFT и ничего не удалено.
    it('удаляет документы начисления периода вместе со снапшотом, если все они DRAFT', async () => {
        const { handler, save, deleteSnapshot, accrualRepo } =
            buildHandler(buildClosedPeriod());
        await accrualRepo.saveAll('service', '2026-08', [
            buildAccrual(42),
            buildAccrual(43),
        ]);
        // Документ другого периода того же направления остаётся.
        const otherPeriod = withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 0,
                lines: [],
            }),
        );
        await accrualRepo.saveAll('service', '2026-07', [otherPeriod]);

        const response = await withRequestContext(() =>
            handler.execute(
                new ReopenAccountingPeriodCommand({
                    direction: 'service',
                    period: '2026-08',
                }),
            ),
        );

        expect(response.status).toBe('OPEN');
        expect(save).toHaveBeenCalledTimes(1);
        expect(deleteSnapshot).toHaveBeenCalledWith('service', '2026-08');
        await expect(
            accrualRepo.findByDirectionAndPeriod('service', '2026-08'),
        ).resolves.toEqual([]);
        await expect(
            accrualRepo.findByDirectionAndPeriod('service', '2026-07'),
        ).resolves.toHaveLength(1);
    });

    it('отклоняет переоткрытие с перечнем документов не в DRAFT и ничего не удаляет', async () => {
        const { handler, save, deleteSnapshot, accrualRepo } =
            buildHandler(buildClosedPeriod());
        const draft = buildAccrual(42);
        const accrued = buildAccrual(43);
        await accrualRepo.saveAll('service', '2026-08', [draft, accrued]);
        accrualRepo.markStatus(accrued.id, 'ACCRUED');

        await withRequestContext(async () => {
            const promise = handler.execute(
                new ReopenAccountingPeriodCommand({
                    direction: 'service',
                    period: '2026-08',
                }),
            );
            await expect(promise).rejects.toThrow(
                SalaryAccrualsNotDraftException,
            );
            await expect(promise).rejects.toMatchObject({
                metadata: {
                    accruals: [
                        { id: accrued.id, employeeId: 43, status: 'ACCRUED' },
                    ],
                },
            });
        });

        expect(save).not.toHaveBeenCalled();
        expect(deleteSnapshot).not.toHaveBeenCalled();
        expect(accrualRepo.store.size).toBe(2);
    });
});
