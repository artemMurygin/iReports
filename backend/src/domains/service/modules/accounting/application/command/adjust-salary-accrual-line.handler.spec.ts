import { AdjustSalaryAccrualLineHandler } from './adjust-salary-accrual-line.handler';
import { AdjustSalaryAccrualLineCommand } from './adjust-salary-accrual-line.command';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import {
    SalaryAccrualLineNotDraftException,
    SalaryAccrualNotFoundException,
} from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import { ArgumentNotProvidedException } from '@/shared/exceptions';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';

// Корректировка строки (PRD 2, Фаза 6): только DRAFT, обязательный
// комментарий, originalAmount не меняется, история корректировок хранится.
describe('AdjustSalaryAccrualLineHandler', () => {
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        updateEmployeesOrder: () => Promise.resolve(),
        findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
        setServiceAccount: () => Promise.resolve(null),
        findEmployees: () => Promise.resolve([]),
    };

    const buildAccrual = () =>
        withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 2000,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        amount: 2000,
                        sources: [],
                    },
                ],
            }),
        );

    const build = (accrual: SalaryAccrual) => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        accrualRepo.store.set(accrual.id, accrual);
        const handler = new AdjustSalaryAccrualLineHandler(
            accrualRepo,
            fakeDirectoryRepo,
        );
        return { handler, accrualRepo };
    };

    const command = (
        accrual: SalaryAccrual,
        lineId: string,
        amount: number,
        comment: string,
    ) =>
        new AdjustSalaryAccrualLineCommand({
            direction: 'service',
            accrualId: accrual.id,
            lineId,
            amount,
            comment,
            adjustedBy: 7,
        });

    it('корректирует строку: amount меняется, originalAmount и total документа — нет, комментарий в ответе', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler } = build(accrual);

        const response = await withRequestContext(() =>
            handler.execute(
                command(accrual, line.id, 1500, 'Простой оборудования'),
            ),
        );

        const responseLine = response.lines.find((item) => item.id === line.id);
        expect(responseLine).toMatchObject({
            amount: 1500,
            originalAmount: 2000,
            status: 'DRAFT',
            adjustmentComment: 'Простой оборудования',
        });
        // Инвариант документа: total = Σ originalAmount строк —
        // корректировка его не задевает (см. SalaryAccrual.validate).
        expect(response.total).toBe(2000);
    });

    it('хранит историю корректировок: вторая корректировка добавляет запись, а не затирает первую', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler, accrualRepo } = build(accrual);

        await withRequestContext(async () => {
            await handler.execute(
                command(accrual, line.id, 1500, 'Первая корректировка'),
            );
            await handler.execute(
                command(accrual, line.id, 1800, 'Вторая корректировка'),
            );
        });

        // История читается из сохранённого состояния (чтение репозитория
        // отдаёт копии, как настоящая БД) — не из локального объекта теста.
        const saved = (await accrualRepo.findById(accrual.id))!;
        const savedLine = saved.lines.find((item) => item.id === line.id)!;
        expect(savedLine.adjustments).toHaveLength(2);
        expect(savedLine.adjustments[0]).toMatchObject({
            previousAmount: 2000,
            newAmount: 1500,
            comment: 'Первая корректировка',
            adjustedBy: 7,
        });
        expect(savedLine.adjustments[1]).toMatchObject({
            previousAmount: 1500,
            newAmount: 1800,
            comment: 'Вторая корректировка',
        });
        expect(savedLine.adjustmentComment).toBe('Вторая корректировка');
        expect(savedLine.amount).toBe(1800);
    });

    it('корректировка проведённой строки → 409', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        withRequestContext(() => accrual.accrueLine(line.id));
        const { handler } = build(accrual);

        await withRequestContext(async () => {
            await expect(
                handler.execute(
                    command(accrual, line.id, 1500, 'Слишком поздно'),
                ),
            ).rejects.toThrow(SalaryAccrualLineNotDraftException);
        });
        expect(line.amount).toBe(2000);
    });

    it('корректировка без комментария → 400 (домен), не сохраняется', async () => {
        const accrual = buildAccrual();
        const line = accrual.lines[0];
        const { handler, accrualRepo } = build(accrual);
        const save = jest.spyOn(accrualRepo, 'save');

        await withRequestContext(async () => {
            await expect(
                handler.execute(command(accrual, line.id, 1500, '   ')),
            ).rejects.toThrow(ArgumentNotProvidedException);
        });
        expect(save).not.toHaveBeenCalled();
        expect(line.amount).toBe(2000);
        expect(line.adjustments).toHaveLength(0);
    });

    it('документ другого направления → 404', async () => {
        const accrual = buildAccrual();
        const { handler } = build(accrual);

        await withRequestContext(async () => {
            await expect(
                handler.execute(
                    new AdjustSalaryAccrualLineCommand({
                        direction: 'shop',
                        accrualId: accrual.id,
                        lineId: accrual.lines[0].id,
                        amount: 1500,
                        comment: 'Не то направление',
                        adjustedBy: 7,
                    }),
                ),
            ).rejects.toThrow(SalaryAccrualNotFoundException);
        });
    });
});
