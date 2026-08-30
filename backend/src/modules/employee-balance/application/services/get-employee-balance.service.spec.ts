import { randomUUID } from 'crypto';
import { GetEmployeeBalanceService } from './get-employee-balance.service';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { BalanceTransaction } from '@/modules/employee-balance/domain/entities/balance-transaction.entity';
import type { BalanceTransactionProps } from '@/modules/employee-balance/domain/entities/balance-transaction.entity';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';
import { InMemoryPayoutCashboxRecordRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/erp-cash/in-memory-payout-cashbox-record.repository';
import { Cashbox } from '@/domains/service/modules/accounting/domain/entities/payout-cashbox-record.entity';

// Общий баланс сотрудника (PRD 2, Фаза 8b): остаток = SUM ВСЕЙ ленты
// сотрудника независимо от направления движений — проверяется на смешанной
// ленте с движениями service и shop; фильтры не влияют на остаток, но дают
// итог по выборке; строка ленты не раскрывается — у движения начисления
// есть ссылка на документ (accrualId).
describe('GetEmployeeBalanceService', () => {
    const transaction = (
        overrides: Partial<BalanceTransactionProps> & { amount: number },
    ) =>
        withRequestContext(
            () =>
                new BalanceTransaction({
                    id: randomUUID(),
                    props: {
                        employeeId: 42,
                        direction: 'service',
                        type: 'BONUS',
                        occurredAt: new Date('2026-07-15'),
                        createdBy: 7,
                        erpSyncRequired: false,
                        ...overrides,
                    },
                }),
        );

    const build = () => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const payoutCashboxRecordRepo =
            new InMemoryPayoutCashboxRecordRepository();
        const service = new GetEmployeeBalanceService(
            transactionRepo,
            payoutCashboxRecordRepo,
        );
        return { service, transactionRepo, payoutCashboxRecordRepo };
    };

    it('остаток = SUM всей ленты сотрудника независимо от направления движений; чужой сотрудник не учитывается', async () => {
        const { service, transactionRepo } = build();
        await transactionRepo.insertMany([
            transaction({ amount: 2000 }),
            transaction({ amount: -500, type: 'ADVANCE' }),
            transaction({ amount: 300, type: 'SICK_LEAVE' }),
            transaction({
                amount: -100,
                type: 'PENALTY',
                comment: 'Опоздание',
            }),
            // Движение направления shop — В ТОМ ЖЕ остатке: баланс общий,
            // direction — лишь атрибут происхождения (Фаза 8b).
            transaction({ amount: 1000, direction: 'shop' }),
            // Другой сотрудник — не в остатке 42-го.
            transaction({ amount: 7777, employeeId: 43 }),
        ]);

        const response = await service.execute(42, {});

        expect(response.balance).toBe(2000 - 500 + 300 - 100 + 1000);
        expect(response.selectionTotal).toBe(response.balance);
        expect(response.transactions).toHaveLength(5);
        expect(response.employeeId).toBe(42);
    });

    it('сотрудник без движений — остаток 0 и пустая лента, не ошибка', async () => {
        const { service } = build();
        const response = await service.execute(42, {});
        expect(response).toMatchObject({
            balance: 0,
            selectionTotal: 0,
            transactions: [],
        });
    });

    it('фильтры по типам и датам сужают ленту и итог по выборке, но не остаток', async () => {
        const { service, transactionRepo } = build();
        await transactionRepo.insertMany([
            transaction({
                amount: 2000,
                occurredAt: new Date('2026-07-10'),
            }),
            transaction({
                amount: -500,
                type: 'ADVANCE',
                occurredAt: new Date('2026-07-20'),
            }),
            transaction({
                amount: -300,
                type: 'ADVANCE',
                direction: 'shop',
                occurredAt: new Date('2026-08-05'),
            }),
        ]);

        const byType = await service.execute(42, {
            types: ['ADVANCE'],
        });
        expect(byType.balance).toBe(1200);
        expect(byType.selectionTotal).toBe(-800);
        expect(byType.transactions).toHaveLength(2);

        const byRange = await service.execute(42, {
            from: new Date('2026-07-01'),
            to: new Date('2026-07-31'),
        });
        expect(byRange.selectionTotal).toBe(1500);
        expect(byRange.transactions).toHaveLength(2);
    });

    it('движение начисления несёт ссылку на документ (accrualId), лента не раскрывается', async () => {
        const { service, transactionRepo } = build();
        const accrual = withRequestContext(() =>
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
                        quantity: 8,
                        rate: 250,
                        amount: 2000,
                        sources: [{ type: 'order', id: 'order-1' }],
                    },
                ],
            }),
        );
        const line = accrual.lines[0];
        await transactionRepo.insertMany(
            withRequestContext(() =>
                BalanceTransaction.forAccruedLine(accrual, line, 7),
            ),
        );

        const response = await service.execute(42, {});

        expect(response.transactions).toHaveLength(1);
        expect(response.transactions[0]).toMatchObject({
            type: 'SALARY_ACCRUAL',
            amount: 2000,
            accrualId: accrual.id,
            lineId: line.id,
            ruleId: 'rule-1',
        });
        // Детализация начисления живёт в документе — в ответе ленты нет
        // раскрытия строки (Фаза 8b).
        expect(response.transactions[0]).not.toHaveProperty('accrualLine');
    });

    // PRD 3 (docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md),
    // «Критерии готовности»: «Внешний ID документа ERP сохраняется и
    // показывается в ленте баланса».
    it('движение с документом ERP несёт system/externalId в поле erp; движение без документа — erp: null', async () => {
        const { service, transactionRepo, payoutCashboxRecordRepo } = build();
        const withErp = transaction({
            amount: -1000,
            type: 'ADVANCE',
            erpSyncRequired: true,
        });
        const withoutErp = transaction({ amount: 500, type: 'BONUS' });
        await transactionRepo.insertMany([withErp, withoutErp]);
        await payoutCashboxRecordRepo.insert(
            Cashbox.createPayout({
                transactionId: withErp.id,
                system: 'ROAPP',
                kind: 'OUTCOME',
                amount: 1000,
                externalId: 'erp-ext-99',
            }),
        );

        const response = await service.execute(42, {});

        const erpRow = response.transactions.find((t) => t.id === withErp.id);
        const plainRow = response.transactions.find(
            (t) => t.id === withoutErp.id,
        );
        expect(erpRow!.erp).toEqual({
            system: 'ROAPP',
            externalId: 'erp-ext-99',
        });
        expect(plainRow!.erp).toBeNull();
    });

    // Фаза 7 (docs/employee-settlements-page-redesign/
    // plan-employee-settlements-page-redesign.md): курсорная пагинация
    // ленты «за всё время» (limit по умолчанию 20) + регресс сортировки
    // (новое движение — первое).
    describe('Фаза 7: курсорная пагинация «за всё время»', () => {
        // occurredAt строго убывает с индексом — index 0 самый новый.
        const dayOffset = (index: number) =>
            new Date(
                new Date('2026-08-01T12:00:00.000Z').getTime() -
                    index * 24 * 60 * 60 * 1000,
            );

        it('первая страница — 20 последних движений по умолчанию, hasMore и nextCursor заданы', async () => {
            const { service, transactionRepo } = build();
            const seeded = Array.from({ length: 25 }, (_, index) =>
                transaction({ amount: 10, occurredAt: dayOffset(index) }),
            );
            await transactionRepo.insertMany(seeded);

            const response = await service.execute(42, {});

            expect(response.transactions).toHaveLength(20);
            expect(response.hasMore).toBe(true);
            expect(response.nextCursor).not.toBeNull();
            // Новые сверху: первая строка страницы — самое свежее движение.
            expect(response.transactions[0].occurredAt.getTime()).toBe(
                dayOffset(0).getTime(),
            );
            expect(response.transactions[19].occurredAt.getTime()).toBe(
                dayOffset(19).getTime(),
            );
            // selectionTotal — сумма ВСЕЙ выборки (25 движений), а не
            // только загруженной страницы (20) — иначе это была бы ошибка
            // Фазы 7 (см. WHY в GetEmployeeBalanceService).
            expect(response.selectionTotal).toBe(250);
        });

        it('вторая страница по nextCursor — оставшиеся более ранние движения, hasMore false на последней странице, без повторов', async () => {
            const { service, transactionRepo } = build();
            const seeded = Array.from({ length: 25 }, (_, index) =>
                transaction({ amount: 10, occurredAt: dayOffset(index) }),
            );
            await transactionRepo.insertMany(seeded);

            const first = await service.execute(42, {});
            const second = await service.execute(42, {
                cursor: first.nextCursor!,
            });

            expect(second.transactions).toHaveLength(5);
            expect(second.hasMore).toBe(false);
            expect(second.nextCursor).toBeNull();
            expect(second.transactions[0].occurredAt.getTime()).toBe(
                dayOffset(20).getTime(),
            );
            const firstPageIds = new Set(first.transactions.map((t) => t.id));
            expect(
                second.transactions.every((t) => !firstPageIds.has(t.id)),
            ).toBe(true);
        });

        it('limit сужает страницу, но не влияет на остаток и selectionTotal', async () => {
            const { service, transactionRepo } = build();
            const seeded = Array.from({ length: 12 }, (_, index) =>
                transaction({ amount: 10, occurredAt: dayOffset(index) }),
            );
            await transactionRepo.insertMany(seeded);

            const paged = await service.execute(42, { limit: 5 });
            const full = await service.execute(42, {});

            expect(paged.transactions).toHaveLength(5);
            expect(paged.hasMore).toBe(true);
            expect(paged.balance).toBe(full.balance);
            expect(paged.selectionTotal).toBe(full.selectionTotal);
            expect(paged.selectionTotal).toBe(120);
        });

        it('без from/to выборка не режется по периоду («за всё время») — движение годовой давности попадает в ленту', async () => {
            const { service, transactionRepo } = build();
            await transactionRepo.insertMany([
                transaction({
                    amount: 100,
                    occurredAt: new Date('2024-01-01'),
                }),
                transaction({
                    amount: 200,
                    occurredAt: new Date('2026-08-01'),
                }),
            ]);

            const response = await service.execute(42, {});

            expect(response.transactions).toHaveLength(2);
            expect(response.selectionTotal).toBe(300);
        });

        // Регресс сортировки (Фаза 7, задача из плана): «сейчас при
        // добавлении нового движения оно попадает в конец ленты вместо
        // начала». Коллизия — два движения одного проведения строки
        // (forAccruedLine) с ОДИНАКОВЫМ occurredAt (один вызов new Date()
        // на оба движения в base) — именно такая коллизия обсуждается в
        // плане Фазы 7 как повод для id-тайбрейкера.
        it('регресс сортировки: новое движение (occurredAt по умолчанию — "сейчас") оказывается первым, несмотря на коллизии occurredAt у уже существующих движений', async () => {
            jest.useFakeTimers();
            try {
                // Существующие движения проведены «в прошлом» (10 дней
                // назад, к моменту закрытия месяца) — время заморожено
                // ДО их создания, чтобы occurredAt/createdAt были строго
                // раньше «сейчас» у fresh ниже, а не совпали с ним из-за
                // общего fake-clock.
                jest.setSystemTime(new Date('2026-08-10T09:00:00.000Z'));
                const { service, transactionRepo } = build();
                const accrual = withRequestContext(() =>
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
                                quantity: 8,
                                rate: 250,
                                amount: 2000,
                                sources: [{ type: 'order', id: 'order-1' }],
                            },
                        ],
                    }),
                );
                const line = accrual.lines[0];
                // Корректировка до проведения — при проведении создаст ДВА
                // движения (SALARY_ACCRUAL + ACCRUAL_ADJUSTMENT) с общим
                // occurredAt (один вызов new Date() на оба в
                // forAccruedLine.base) — именно эта коллизия обсуждается в
                // плане Фазы 7 как повод для id-тайбрейкера. Оба движения
                // датированы «в прошлом» (см. выше), реальный репортед баг —
                // про НОВОЕ движение, добавленное сегодня, а не про порядок
                // внутри этой историчной пары (тот отдельно проверен тестом
                // «id — детерминированный тайбрейкер» ниже).
                withRequestContext(() => line.adjust(1800, 'Корректировка', 7));
                const accruedTransactions = withRequestContext(() =>
                    BalanceTransaction.forAccruedLine(accrual, line, 7),
                );
                await transactionRepo.insertMany(accruedTransactions);

                // Новое ручное движение, добавленное «сейчас» — время
                // сдвинуто вперёд относительно движений выше (без явного
                // occurredAt — тот же путь, что и у
                // CreateBalanceTransactionHandler).
                jest.setSystemTime(new Date('2026-08-20T10:00:00.000Z'));
                const fresh = withRequestContext(() =>
                    BalanceTransaction.createManual({
                        employeeId: 42,
                        direction: 'service',
                        type: 'ADVANCE',
                        amount: 1000,
                        createdBy: 7,
                    }),
                );
                await transactionRepo.insertMany([fresh]);

                const response = await service.execute(42, {});

                expect(response.transactions[0].id).toBe(fresh.id);
            } finally {
                jest.useRealTimers();
            }
        });

        // Тайбрейкер по id (задача Фазы 7: «добавить id как третий
        // тайбрейкер... для полной детерминированности») — при полностью
        // совпадающих occurredAt И createdAt порядок пары обязан быть
        // одинаковым при каждом вызове, а не зависеть от порядка вставки/
        // итерации Map.
        it('id — детерминированный тайбрейкер при полностью совпадающих occurredAt и createdAt', async () => {
            const { service, transactionRepo } = build();
            const collisionTimestamp = new Date('2026-08-10T09:00:00.000Z');
            const a = withRequestContext(
                () =>
                    new BalanceTransaction({
                        id: 'aaaaaaaa-0000-0000-0000-000000000000',
                        createdAt: collisionTimestamp,
                        props: {
                            employeeId: 42,
                            direction: 'service',
                            type: 'BONUS',
                            amount: 100,
                            occurredAt: collisionTimestamp,
                            createdBy: 7,
                            erpSyncRequired: false,
                        },
                    }),
            );
            const b = withRequestContext(
                () =>
                    new BalanceTransaction({
                        id: 'bbbbbbbb-0000-0000-0000-000000000000',
                        createdAt: collisionTimestamp,
                        props: {
                            employeeId: 42,
                            direction: 'service',
                            type: 'SICK_LEAVE',
                            amount: 200,
                            occurredAt: collisionTimestamp,
                            createdBy: 7,
                            erpSyncRequired: false,
                        },
                    }),
            );
            // Вставляем в порядке, обратном ожидаемому id-тайбрейкеру
            // (a < b по строке, ожидаем b первым — id DESC), чтобы порядок
            // вставки заведомо не мог случайно совпасть с ожидаемым
            // результатом.
            await transactionRepo.insertMany([a, b]);

            const response = await service.execute(42, {});

            expect(response.transactions.map((t) => t.id)).toEqual([
                b.id,
                a.id,
            ]);
        });
    });
});
