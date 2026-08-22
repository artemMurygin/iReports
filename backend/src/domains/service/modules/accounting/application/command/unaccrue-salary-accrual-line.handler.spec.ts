import { AccrueSalaryAccrualLineHandler } from './accrue-salary-accrual-line.handler';
import { AccrueSalaryAccrualLineCommand } from './accrue-salary-accrual-line.command';
import { UnaccrueSalaryAccrualLineHandler } from './unaccrue-salary-accrual-line.handler';
import { UnaccrueSalaryAccrualLineCommand } from './unaccrue-salary-accrual-line.command';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import {
    SalaryAccrualLineNotAccruedException,
    SalaryAccrualPaidException,
} from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/testing/in-memory-salary-accrual.repository';
import { InMemoryBalanceTransactionRepository } from '@/domains/service/modules/accounting/testing/in-memory-balance-transaction.repository';

// Отмена начисления (PRD 2, Фаза 6): движения SALARY_ACCRUAL и
// ACCRUAL_ADJUSTMENT строки удаляются с баланса без следа, строка
// возвращается в DRAFT и снова доступна для корректировки и проведения.
describe('UnaccrueSalaryAccrualLineHandler', () => {
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        findEmployees: () => Promise.resolve([]),
    };

    const buildAccrual = () =>
        withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 3000,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        amount: 2000,
                        sources: [],
                    },
                    {
                        ruleId: 'rule-2',
                        type: 'OrderPayed',
                        name: 'Процент с заказов',
                        targetRole: 'ENGINEER',
                        amount: 1000,
                        sources: [],
                    },
                ],
            }),
        );

    const build = (accrual: SalaryAccrual) => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        accrualRepo.store.set(accrual.id, accrual);
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const unitOfWork: UnitOfWorkPort = { run: (work) => work() };
        const accrueHandler = new AccrueSalaryAccrualLineHandler(
            accrualRepo,
            transactionRepo,
            fakeDirectoryRepo,
            unitOfWork,
        );
        const handler = new UnaccrueSalaryAccrualLineHandler(
            accrualRepo,
            transactionRepo,
            fakeDirectoryRepo,
            unitOfWork,
        );
        return { handler, accrueHandler, accrualRepo, transactionRepo };
    };

    const accrue = (accrual: SalaryAccrual, lineId: string) =>
        new AccrueSalaryAccrualLineCommand({
            direction: 'service',
            accrualId: accrual.id,
            lineId,
            accruedBy: 7,
        });

    const unaccrue = (accrual: SalaryAccrual, lineId: string) =>
        new UnaccrueSalaryAccrualLineCommand({
            direction: 'service',
            accrualId: accrual.id,
            lineId,
        });

    it('удаляет оба движения скорректированной строки, строка снова DRAFT, документ пересчитан', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        withRequestContext(() =>
            accrual.adjustLine(line.id, 2500, 'Доплата за сложность', 7),
        );
        const { handler, accrueHandler, transactionRepo } = build(accrual);

        await withRequestContext(async () => {
            await accrueHandler.execute(accrue(accrual, line.id));
            expect(transactionRepo.store.size).toBe(2);

            const response = await handler.execute(unaccrue(accrual, line.id));

            // Оба движения строки удалены полностью: следа в ленте
            // не остаётся (PRD 2, единственное исключение из
            // неизменяемости ленты).
            expect(transactionRepo.store.size).toBe(0);
            expect(response.status).toBe('DRAFT');
            expect(response.accruedLinesCount).toBe(0);
            expect(
                response.lines.find((item) => item.id === line.id)?.status,
            ).toBe('DRAFT');
        });
    });

    it('удаляет только движения своей строки', async () => {
        const accrual = buildAccrual();
        const { handler, accrueHandler, transactionRepo } = build(accrual);

        await withRequestContext(async () => {
            await accrueHandler.execute(accrue(accrual, accrual.lines[0].id));
            await accrueHandler.execute(accrue(accrual, accrual.lines[1].id));
            expect(transactionRepo.store.size).toBe(2);

            const response = await handler.execute(
                unaccrue(accrual, accrual.lines[0].id),
            );

            expect(transactionRepo.store.size).toBe(1);
            expect([...transactionRepo.store.values()][0].lineId).toBe(
                accrual.lines[1].id,
            );
            expect(response.status).toBe('PARTIALLY_ACCRUED');
        });
    });

    it('после отмены строку можно скорректировать и провести заново', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler, accrueHandler, accrualRepo, transactionRepo } =
            build(accrual);

        await withRequestContext(async () => {
            await accrueHandler.execute(accrue(accrual, line.id));
            await handler.execute(unaccrue(accrual, line.id));

            // Корректировка после отмены — через свежепрочитанный из
            // репозитория агрегат (чтение отдаёт копии, как настоящая БД).
            const stored = (await accrualRepo.findById(accrual.id))!;
            stored.adjustLine(line.id, 1800, 'Пересчёт после отмены', 7);
            await accrualRepo.save(stored);
            const response = await accrueHandler.execute(
                accrue(accrual, line.id),
            );

            const transactions = [...transactionRepo.store.values()].filter(
                (transaction) => transaction.lineId === line.id,
            );
            expect(transactions).toHaveLength(2);
            expect(
                transactions.reduce(
                    (sum, transaction) => sum + transaction.amount,
                    0,
                ),
            ).toBe(1800);
            expect(
                response.lines.find((item) => item.id === line.id)?.status,
            ).toBe('ACCRUED');
        });
    });

    it('отмена непроведённой строки → 409', async () => {
        const accrual = buildAccrual();
        const { handler } = build(accrual);

        await withRequestContext(async () => {
            await expect(
                handler.execute(unaccrue(accrual, accrual.lines[0].id)),
            ).rejects.toThrow(SalaryAccrualLineNotAccruedException);
        });
    });

    it('отмена строки выплаченного документа → 409, движения на месте', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler, accrueHandler, accrualRepo, transactionRepo } =
            build(accrual);

        await withRequestContext(async () => {
            await accrueHandler.execute(accrue(accrual, line.id));
            accrualRepo.markStatus(accrual.id, 'PAID');

            await expect(
                handler.execute(unaccrue(accrual, line.id)),
            ).rejects.toThrow(SalaryAccrualPaidException);
        });
        expect(transactionRepo.store.size).toBe(1);
    });
});
