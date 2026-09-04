import { AccrueSalaryAccrualLineHandler } from './accrue-salary-accrual-line.handler';
import { AccrueSalaryAccrualLineCommand } from './accrue-salary-accrual-line.command';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { Period } from '@/shared/domain/period.value-object';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual/salary-accrual.entity';
import { SalaryAccrualLine } from '@/domains/service/modules/accounting/domain/entities/salary-accrual/salary-accrual-line.entity';
import {
    SalaryAccrualLineAlreadyAccruedException,
    SalaryAccrualNotFoundException,
    SalaryAccrualPaidException,
} from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';

// Проведение строки документа начисления (PRD 2, Фаза 6): ровно одно
// движение SALARY_ACCRUAL на нескорректированную строку, два движения на
// скорректированную (сумма = новая), идемпотентность прямого повтора и
// гонки по уникальному индексу.
describe('AccrueSalaryAccrualLineHandler', () => {
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
                total: 3000,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        quantity: 8,
                        rate: 250,
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
        const handler = new AccrueSalaryAccrualLineHandler(
            accrualRepo,
            transactionRepo,
            fakeDirectoryRepo,
            unitOfWork,
        );
        return { handler, accrualRepo, transactionRepo };
    };

    const command = (accrual: SalaryAccrual, lineId: string) =>
        new AccrueSalaryAccrualLineCommand({
            direction: 'service',
            accrualId: accrual.id,
            lineId,
            accruedBy: 7,
        });

    it('проводит строку: ровно одно движение SALARY_ACCRUAL со ссылками, строка ACCRUED, документ PARTIALLY_ACCRUED', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler, transactionRepo, accrualRepo } = build(accrual);

        const response = await withRequestContext(() =>
            handler.execute(command(accrual, line.id)),
        );

        const transactions = [...transactionRepo.store.values()];
        expect(transactions).toHaveLength(1);
        expect(transactions[0]).toMatchObject({
            type: 'SALARY_ACCRUAL',
            amount: 2000,
            employeeId: 42,
            direction: 'service',
            period: '2026-07',
            accrualId: accrual.id,
            lineId: line.id,
            ruleId: 'rule-1',
            createdBy: 7,
            // Комментарий заполняется автоматически (правило · месяц) — по
            // кнопке «Начислить» сотрудник ничего не вводит вручную (PRD 2).
            comment: 'Почасовая ставка · июль 2026',
        });

        expect(response.status).toBe('PARTIALLY_ACCRUED');
        expect(response.accruedLinesCount).toBe(1);
        expect(response.lines.find((item) => item.id === line.id)?.status).toBe(
            'ACCRUED',
        );

        const saved = await accrualRepo.findById(accrual.id);
        expect(saved?.status).toBe('PARTIALLY_ACCRUED');
    });

    it('проведение всех строк переводит документ в ACCRUED («Ожидает выплаты»)', async () => {
        const accrual = buildAccrual();
        const { handler, transactionRepo } = build(accrual);

        await withRequestContext(async () => {
            await handler.execute(command(accrual, accrual.lines[0].id));
            const response = await handler.execute(
                command(accrual, accrual.lines[1].id),
            );
            expect(response.status).toBe('ACCRUED');
            expect(response.accruedLinesCount).toBe(2);
        });
        expect(transactionRepo.store.size).toBe(2);
    });

    it('скорректированная строка → два движения (SALARY_ACCRUAL на снапшот + ACCRUAL_ADJUSTMENT на разницу с комментарием), сумма = новая', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        withRequestContext(() =>
            accrual.adjustLine(line.id, 1500, 'Простой оборудования', 7),
        );
        const { handler, transactionRepo } = build(accrual);

        await withRequestContext(() =>
            handler.execute(command(accrual, line.id)),
        );

        const transactions = [...transactionRepo.store.values()].filter(
            (transaction) => transaction.lineId === line.id,
        );
        expect(transactions).toHaveLength(2);
        const accrualTx = transactions.find(
            (transaction) => transaction.type === 'SALARY_ACCRUAL',
        );
        const adjustmentTx = transactions.find(
            (transaction) => transaction.type === 'ACCRUAL_ADJUSTMENT',
        );
        // SALARY_ACCRUAL — сумма снапшота, корректировка — разница; сотрудник
        // в ленте видит, сколько насчитала система и на сколько изменил
        // руководитель (PRD 2).
        expect(accrualTx?.amount).toBe(2000);
        expect(adjustmentTx).toMatchObject({
            amount: -500,
            comment: 'Простой оборудования',
            accrualId: accrual.id,
            lineId: line.id,
            ruleId: 'rule-1',
        });
        expect((accrualTx?.amount ?? 0) + (adjustmentTx?.amount ?? 0)).toBe(
            1500,
        );
    });

    it('нескорректированная строка ACCRUAL_ADJUSTMENT не создаёт', async () => {
        const accrual = buildAccrual();
        const { handler, transactionRepo } = build(accrual);

        await withRequestContext(() =>
            handler.execute(command(accrual, accrual.lines[0].id)),
        );

        expect(
            [...transactionRepo.store.values()].filter(
                (transaction) => transaction.type === 'ACCRUAL_ADJUSTMENT',
            ),
        ).toHaveLength(0);
    });

    it('повторное проведение той же строки → 409, второго движения нет', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler, transactionRepo } = build(accrual);

        await withRequestContext(async () => {
            await handler.execute(command(accrual, line.id));
            await expect(
                handler.execute(command(accrual, line.id)),
            ).rejects.toThrow(SalaryAccrualLineAlreadyAccruedException);
        });
        expect(transactionRepo.store.size).toBe(1);
    });

    it('параллельный двойной accrue: гонку останавливает уникальный индекс (lineId, type) — одно движение, статус не задвоен', async () => {
        // Эмуляция гонки: репозиторий оба раза отдаёт свежесобранную DRAFT-
        // копию документа (как два параллельных запроса, прочитавших строку
        // до проведения) — доменная проверка статуса пройдена обоими, и
        // только вставка в ленту с уникальным индексом отсекает второго.
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler, accrualRepo, transactionRepo } = build(accrual);
        // DRAFT-копия того же документа с теми же id строк — состояние,
        // которое видит второй параллельный запрос до коммита первого.
        const staleCopy = withRequestContext(
            () =>
                new SalaryAccrual({
                    id: accrual.id,
                    props: {
                        direction: accrual.direction,
                        period: Period.create(accrual.period),
                        employeeId: accrual.employeeId,
                        status: 'DRAFT',
                        isDismissed: accrual.isDismissed,
                        total: accrual.total,
                        lines: accrual.lines.map(
                            (item) =>
                                new SalaryAccrualLine({
                                    id: item.id,
                                    props: {
                                        position: item.position,
                                        ruleId: item.ruleId,
                                        type: item.type,
                                        name: item.name,
                                        targetRole: item.targetRole,
                                        salaryBasis: item.salaryBasis,
                                        quantity: item.quantity,
                                        rate: item.rate,
                                        originalAmount: item.originalAmount,
                                        amount: item.amount,
                                        sources: item.sources,
                                        status: 'DRAFT',
                                        adjustments: [],
                                    },
                                }),
                        ),
                    },
                }),
        );
        const findById = jest
            .spyOn(accrualRepo, 'findById')
            .mockResolvedValueOnce(accrual)
            .mockResolvedValueOnce(staleCopy);

        await withRequestContext(async () => {
            await handler.execute(command(accrual, line.id));
            await expect(
                handler.execute(command(accrual, line.id)),
            ).rejects.toThrow(SalaryAccrualLineAlreadyAccruedException);
        });

        expect(findById).toHaveBeenCalledTimes(2);
        expect(transactionRepo.store.size).toBe(1);
        // Откат транзакции гонки не задел сохранённый статус первого
        // проведения.
        const saved = accrualRepo.store.get(accrual.id);
        expect(saved?.accruedLinesCount).toBe(1);
    });

    it('документ другого направления не найден (404), выплаченный — 409', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler, accrualRepo } = build(accrual);

        await withRequestContext(async () => {
            await expect(
                handler.execute(
                    new AccrueSalaryAccrualLineCommand({
                        direction: 'shop',
                        accrualId: accrual.id,
                        lineId: line.id,
                        accruedBy: 7,
                    }),
                ),
            ).rejects.toThrow(SalaryAccrualNotFoundException);

            accrualRepo.markStatus(accrual.id, 'PAID');
            await expect(
                handler.execute(command(accrual, line.id)),
            ).rejects.toThrow(SalaryAccrualPaidException);
        });
    });
});
