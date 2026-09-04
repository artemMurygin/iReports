import type { CommandBus } from '@nestjs/cqrs';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';
import { AccrueSalaryAccrualLineHandler } from './accrue-salary-accrual-line.handler';
import { AccruePeriodSalaryAccrualsHandler } from './accrue-period-salary-accruals.handler';
import { AccruePeriodSalaryAccrualsCommand } from './accrue-period-salary-accruals.command';

// «Начислить все документы месяца» (PRD 2, Фаза 7): все документы
// направления за период построчно; статистика для модалки результата и
// перечень ошибок; PAID пропускается; чужой период/направление не трогается.
describe('AccruePeriodSalaryAccrualsHandler', () => {
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        updateEmployeesOrder: () => Promise.resolve(),
        findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
        setServiceAccount: () => Promise.resolve(null),
        findEmployees: () =>
            Promise.resolve([
                {
                    id: 42,
                    firstName: 'Иван',
                    lastName: 'Петров',
                    departmentId: 5,
                },
                {
                    id: 43,
                    firstName: 'Пётр',
                    lastName: 'Сидоров',
                    departmentId: 5,
                },
            ]),
    };

    const buildAccrual = (
        employeeId: number,
        amount: number,
        period = '2026-07',
    ) =>
        withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period,
                employeeId,
                isDismissed: false,
                total: amount,
                lines: [
                    {
                        ruleId: `rule-${employeeId}`,
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        amount,
                        sources: [],
                    },
                ],
            }),
        );

    const build = (accruals: SalaryAccrual[]) => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        for (const accrual of accruals) {
            accrualRepo.store.set(accrual.id, accrual);
        }
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const unitOfWork: UnitOfWorkPort = { run: (work) => work() };
        const lineHandler = new AccrueSalaryAccrualLineHandler(
            accrualRepo,
            transactionRepo,
            fakeDirectoryRepo,
            unitOfWork,
        );
        const commandBus = {
            execute: (command: unknown) =>
                lineHandler.execute(
                    command as Parameters<
                        AccrueSalaryAccrualLineHandler['execute']
                    >[0],
                ),
        } as unknown as CommandBus;
        const handler = new AccruePeriodSalaryAccrualsHandler(
            accrualRepo,
            fakeDirectoryRepo,
            commandBus,
        );
        return { handler, accrualRepo, transactionRepo };
    };

    const command = () =>
        new AccruePeriodSalaryAccrualsCommand({
            direction: 'service',
            period: '2026-07',
            accruedBy: 7,
        });

    it('проводит все документы периода: статистика полная, чужой период не тронут', async () => {
        const first = buildAccrual(42, 2000);
        const second = buildAccrual(43, 3000);
        const otherPeriod = buildAccrual(42, 9000, '2026-06');
        const { handler, transactionRepo, accrualRepo } = build([
            first,
            second,
            otherPeriod,
        ]);

        const response = await withRequestContext(() =>
            handler.execute(command()),
        );

        expect(response).toMatchObject({
            direction: 'service',
            period: '2026-07',
            documentsCount: 2,
            accruedDocumentsCount: 2,
            accruedLinesCount: 2,
            accruedAmount: 5000,
            failures: [],
        });
        expect(transactionRepo.store.size).toBe(2);
        const untouched = await accrualRepo.findById(otherPeriod.id);
        expect(untouched?.status).toBe('DRAFT');
    });

    it('инъекция ошибки на строке одного документа: остальные проведены, ошибка в перечне со статистикой', async () => {
        const first = buildAccrual(42, 2000);
        const second = buildAccrual(43, 3000);
        const failingLine = second.lines[0];
        const { handler, transactionRepo } = build([first, second]);
        const originalInsert = transactionRepo.insertMany.bind(
            transactionRepo,
        ) as (typeof transactionRepo)['insertMany'];
        jest.spyOn(transactionRepo, 'insertMany').mockImplementation(
            (transactions) =>
                transactions.some(
                    (transaction) => transaction.lineId === failingLine.id,
                )
                    ? Promise.reject(new Error('БД недоступна'))
                    : originalInsert(transactions),
        );

        const response = await withRequestContext(() =>
            handler.execute(command()),
        );

        expect(response).toMatchObject({
            documentsCount: 2,
            accruedDocumentsCount: 1,
            accruedLinesCount: 1,
            accruedAmount: 2000,
        });
        expect(response.failures).toEqual([
            {
                accrualId: second.id,
                employeeId: 43,
                employeeName: 'Пётр Сидоров',
                lineId: failingLine.id,
                ruleName: 'Почасовая ставка',
                message: 'БД недоступна',
            },
        ]);
        expect(transactionRepo.store.size).toBe(1);
    });

    it('выплаченный документ пропускается, открытый период — нулевая статистика', async () => {
        const paid = buildAccrual(42, 2000);
        const { handler, accrualRepo, transactionRepo } = build([paid]);
        accrualRepo.markStatus(paid.id, 'PAID');

        const response = await withRequestContext(() =>
            handler.execute(command()),
        );
        expect(response).toMatchObject({
            documentsCount: 1,
            // PAID уже «полностью проведён» — считается в
            // accruedDocumentsCount, но движений операция не создаёт.
            accruedDocumentsCount: 1,
            accruedLinesCount: 0,
            accruedAmount: 0,
            failures: [],
        });
        expect(transactionRepo.store.size).toBe(0);

        const empty = await withRequestContext(() =>
            handler.execute(
                new AccruePeriodSalaryAccrualsCommand({
                    direction: 'service',
                    period: '2026-01',
                    accruedBy: 7,
                }),
            ),
        );
        expect(empty).toMatchObject({
            documentsCount: 0,
            accruedDocumentsCount: 0,
            accruedLinesCount: 0,
            accruedAmount: 0,
            failures: [],
        });
    });
});
