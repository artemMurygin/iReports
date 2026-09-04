import type { CommandBus } from '@nestjs/cqrs';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import {
    SalaryAccrualNotFoundException,
    SalaryAccrualPaidException,
} from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';
import { AccrueSalaryAccrualLineHandler } from './accrue-salary-accrual-line.handler';
import { AccrueSalaryAccrualDocumentHandler } from './accrue-salary-accrual-document.handler';
import { AccrueSalaryAccrualDocumentCommand } from './accrue-salary-accrual-document.command';

// «Начислить всё» по документу (PRD 2, Фаза 7): построчное проведение в
// своих транзакциях — сбой одной строки не откатывает остальные и попадает
// в перечень failures ответа (частичный сбой не остаётся незамеченным).
describe('AccrueSalaryAccrualDocumentHandler', () => {
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
            ]),
    };

    const buildAccrual = () =>
        withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 4500,
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
                        amount: 1500,
                        sources: [],
                    },
                    {
                        ruleId: 'rule-3',
                        type: 'ServiceCompleted',
                        name: 'Бонус за услуги',
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
        const lineHandler = new AccrueSalaryAccrualLineHandler(
            accrualRepo,
            transactionRepo,
            fakeDirectoryRepo,
            unitOfWork,
        );
        // Реальный построчный хендлер за фасадом CommandBus — тот же путь,
        // что в приложении (общий CommandBus, повторное чтение документа и
        // своя транзакция на каждую строку).
        const commandBus = {
            execute: (command: unknown) =>
                lineHandler.execute(
                    command as Parameters<
                        AccrueSalaryAccrualLineHandler['execute']
                    >[0],
                ),
        } as unknown as CommandBus;
        const handler = new AccrueSalaryAccrualDocumentHandler(
            accrualRepo,
            fakeDirectoryRepo,
            commandBus,
        );
        return { handler, accrualRepo, transactionRepo };
    };

    const command = (accrual: SalaryAccrual) =>
        new AccrueSalaryAccrualDocumentCommand({
            direction: 'service',
            accrualId: accrual.id,
            accruedBy: 7,
        });

    it('проводит все непроведённые строки: документ ACCRUED, движение на каждую строку, failures пуст', async () => {
        const accrual = buildAccrual();
        const { handler, transactionRepo } = build(accrual);

        const response = await withRequestContext(() =>
            handler.execute(command(accrual)),
        );

        expect(response.failures).toEqual([]);
        expect(response.accrual.status).toBe('ACCRUED');
        expect(response.accrual.accruedLinesCount).toBe(3);
        expect(transactionRepo.store.size).toBe(3);
    });

    it('инъекция ошибки на одной строке: остальные проведены, ошибка в ответе с ФИО и правилом, документ PARTIALLY_ACCRUED', async () => {
        const accrual = buildAccrual();
        const failingLine = accrual.lines[1];
        const { handler, transactionRepo, accrualRepo } = build(accrual);
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
            handler.execute(command(accrual)),
        );

        expect(response.failures).toEqual([
            {
                accrualId: accrual.id,
                employeeId: 42,
                employeeName: 'Иван Петров',
                lineId: failingLine.id,
                ruleName: 'Процент с заказов',
                message: 'БД недоступна',
            },
        ]);
        expect(response.accrual.status).toBe('PARTIALLY_ACCRUED');
        expect(response.accrual.accruedLinesCount).toBe(2);
        // Движения только у успешно проведённых строк — упавшая строка
        // осталась без движения и без смены статуса.
        expect(transactionRepo.store.size).toBe(2);
        const saved = await accrualRepo.findById(accrual.id);
        expect(
            saved?.lines.find((line) => line.id === failingLine.id)?.status,
        ).toBe('DRAFT');
    });

    it('полностью проведённый документ — no-op с пустым перечнем; повторный вызов не создаёт движений', async () => {
        const accrual = buildAccrual();
        const { handler, transactionRepo } = build(accrual);

        await withRequestContext(async () => {
            await handler.execute(command(accrual));
            const repeated = await handler.execute(command(accrual));
            expect(repeated.failures).toEqual([]);
            expect(repeated.accrual.status).toBe('ACCRUED');
        });
        expect(transactionRepo.store.size).toBe(3);
    });

    it('документ другого направления — 404, выплаченный — 409', async () => {
        const accrual = buildAccrual();
        const { handler, accrualRepo } = build(accrual);

        await withRequestContext(async () => {
            await expect(
                handler.execute(
                    new AccrueSalaryAccrualDocumentCommand({
                        direction: 'shop',
                        accrualId: accrual.id,
                        accruedBy: 7,
                    }),
                ),
            ).rejects.toThrow(SalaryAccrualNotFoundException);

            accrualRepo.markStatus(accrual.id, 'PAID');
            await expect(handler.execute(command(accrual))).rejects.toThrow(
                SalaryAccrualPaidException,
            );
        });
    });
});
