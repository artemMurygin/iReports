import type {
    ManualBalanceTransactionType,
    ErpCashDocumentKind,
} from 'ireports-contracts';
import {
    ArgumentInvalidException,
    ArgumentNotProvidedException,
} from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type {
    CreateErpCashDocumentParams,
    DeleteErpCashDocumentParams,
    ErpCashDocumentPort,
} from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';
import { InMemoryPayoutCashboxRecordRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/erp-cash/in-memory-payout-cashbox-record.repository';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { CreateBalanceTransactionHandler } from './create-balance-transaction.handler';
import { CreateBalanceTransactionCommand } from './create-balance-transaction.command';

// Ручные движения (PRD 2, Фаза 7; касса ERP — PRD 3, Фаза 12): каждый тип,
// знак по типу (для ADJUSTMENT — явно), обязательный комментарий для
// PENALTY/ADJUSTMENT, дата задним числом, минус без лимита. erpSyncRequired
// = false — только хранится (ERP не трогается); erpSyncRequired = true —
// синхронный порядок «ERP → транзакция БД», с компенсацией при сбое БД.
describe('CreateBalanceTransactionHandler', () => {
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

    const build = (overrides?: {
        erpPort?: ErpCashDocumentPort;
        shopErpPort?: ErpCashDocumentPort;
        unitOfWork?: UnitOfWorkPort;
        accrualRepo?: InMemorySalaryAccrualRepository;
    }) => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const payoutCashboxRecordRepo =
            new InMemoryPayoutCashboxRecordRepository();
        const accrualRepo =
            overrides?.accrualRepo ?? new InMemorySalaryAccrualRepository();
        const fakeErpPort: ErpCashDocumentPort = overrides?.erpPort ?? {
            create: (params: CreateErpCashDocumentParams) =>
                Promise.resolve({ externalId: `erp-${params.transactionId}` }),
            delete: (_params: DeleteErpCashDocumentParams) => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const shopErpPort: ErpCashDocumentPort =
            overrides?.shopErpPort ?? fakeErpPort;
        const unitOfWork: UnitOfWorkPort = overrides?.unitOfWork ?? {
            run: (work) => work(),
        };
        const handler = new CreateBalanceTransactionHandler(
            transactionRepo,
            accrualRepo,
            fakeErpPort,
            shopErpPort,
            payoutCashboxRecordRepo,
            fakeDirectoryRepo,
            unitOfWork,
            new EmployeeOperationLock(),
        );
        return {
            handler,
            transactionRepo,
            payoutCashboxRecordRepo,
            accrualRepo,
            fakeErpPort,
            shopErpPort,
        };
    };

    const command = (
        overrides: Partial<{
            direction: 'service' | 'shop';
            type: ManualBalanceTransactionType;
            amount: number;
            comment: string | undefined;
            occurredAt: Date | undefined;
            period: string | undefined;
            erpSyncRequired: boolean;
        }> = {},
    ) =>
        new CreateBalanceTransactionCommand({
            direction: overrides.direction ?? 'service',
            employeeId: 42,
            type: overrides.type ?? 'ADVANCE',
            amount: overrides.amount ?? 5000,
            occurredAt: overrides.occurredAt,
            comment: overrides.comment,
            period: overrides.period,
            createdBy: 7,
            erpSyncRequired: overrides.erpSyncRequired ?? false,
        });

    it.each<[ManualBalanceTransactionType, number, number, string | undefined]>(
        [
            // тип, сумма в запросе (абсолютная), ожидаемая сумма в ленте
            ['ADVANCE', 5000, -5000, undefined],
            ['EXTRA_ADVANCE', 3000, -3000, undefined],
            ['PENALTY', 1000, -1000, 'Опоздание'],
            ['BONUS', 4000, 4000, undefined],
            ['SICK_LEAVE', 2500, 2500, undefined],
            ['VACATION_PAY', 6000, 6000, undefined],
        ],
    )(
        'создаёт движение %s: знак по типу, в ленте сумма %i → %i',
        async (type, amount, expected, comment) => {
            const { handler, transactionRepo } = build();

            const response = await withRequestContext(() =>
                handler.execute(command({ type, amount, comment })),
            );

            expect(response).toMatchObject({
                type,
                amount: expected,
                employeeId: 42,
                direction: 'service',
                createdBy: 7,
                erpSyncRequired: false,
            });
            expect(transactionRepo.store.size).toBe(1);
        },
    );

    it('ADJUSTMENT: знак задаётся явно — и приход, и расход; нулевая сумма отклоняется', async () => {
        const { handler } = build();

        await withRequestContext(async () => {
            const positive = await handler.execute(
                command({
                    type: 'ADJUSTMENT',
                    amount: 700,
                    comment: 'Недоплата за июль',
                }),
            );
            expect(positive.amount).toBe(700);

            const negative = await handler.execute(
                command({
                    type: 'ADJUSTMENT',
                    amount: -300,
                    comment: 'Переплата за июль',
                }),
            );
            expect(negative.amount).toBe(-300);

            await expect(
                handler.execute(
                    command({
                        type: 'ADJUSTMENT',
                        amount: 0,
                        comment: 'Ноль',
                    }),
                ),
            ).rejects.toThrow(ArgumentInvalidException);
        });
    });

    it('PENALTY и ADJUSTMENT без комментария отклоняются (400)', async () => {
        const { handler, transactionRepo } = build();

        await withRequestContext(async () => {
            await expect(
                handler.execute(command({ type: 'PENALTY', amount: 1000 })),
            ).rejects.toThrow(ArgumentNotProvidedException);
            await expect(
                handler.execute(
                    command({ type: 'PENALTY', amount: 1000, comment: '  ' }),
                ),
            ).rejects.toThrow(ArgumentNotProvidedException);
            await expect(
                handler.execute(command({ type: 'ADJUSTMENT', amount: 500 })),
            ).rejects.toThrow(ArgumentNotProvidedException);
        });
        expect(transactionRepo.store.size).toBe(0);
    });

    it('для типов со знаком по типу сумма в запросе — только положительная', async () => {
        const { handler } = build();

        await withRequestContext(async () => {
            await expect(
                handler.execute(command({ type: 'ADVANCE', amount: -5000 })),
            ).rejects.toThrow(ArgumentInvalidException);
            await expect(
                handler.execute(command({ type: 'BONUS', amount: 0 })),
            ).rejects.toThrow(ArgumentInvalidException);
        });
    });

    it('дата задним числом сохраняется как дата движения, createdAt остаётся датой записи; период хранится', async () => {
        const { handler, transactionRepo } = build();
        const backdated = new Date('2026-07-15T00:00:00.000Z');

        const response = await withRequestContext(() =>
            handler.execute(
                command({
                    occurredAt: backdated,
                    period: '2026-07',
                }),
            ),
        );

        expect(new Date(response.occurredAt)).toEqual(backdated);
        expect(new Date(response.createdAt).getTime()).toBeGreaterThan(
            backdated.getTime(),
        );
        expect(response.period).toBe('2026-07');
        expect(transactionRepo.store.size).toBe(1);
    });

    it('лимитов на аванс нет: авансы при нулевом остатке уводят баланс в минус', async () => {
        const { handler, transactionRepo } = build();

        await withRequestContext(async () => {
            await handler.execute(command({ type: 'ADVANCE', amount: 5000 }));
            await handler.execute(
                command({ type: 'EXTRA_ADVANCE', amount: 2000 }),
            );
        });

        await expect(transactionRepo.sumByEmployee(42)).resolves.toBe(-7000);
    });

    // ========================== erpSyncRequired: true (PRD 3, Фаза 12) ========================== //

    it('erpSyncRequired: true — сначала запрос в ERP, затем движение и связка Cashbox в одной транзакции', async () => {
        const createCalls: CreateErpCashDocumentParams[] = [];
        const erpPort: ErpCashDocumentPort = {
            create: (params) => {
                createCalls.push(params);
                return Promise.resolve({ externalId: 'erp-ext-1' });
            },
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, payoutCashboxRecordRepo } = build({
            erpPort,
        });

        const response = await withRequestContext(() =>
            handler.execute(
                command({
                    type: 'ADVANCE',
                    amount: 3000,
                    erpSyncRequired: true,
                    period: '2026-07',
                }),
            ),
        );

        expect(response.erpSyncRequired).toBe(true);
        expect(response.amount).toBe(-3000);
        expect(transactionRepo.store.size).toBe(1);

        // ADVANCE — расход: kind OUTCOME, сумма ERP — без знака (модуль).
        expect(createCalls).toHaveLength(1);
        expect(createCalls[0]).toMatchObject({
            amount: 3000,
            kind: 'OUTCOME' satisfies ErpCashDocumentKind,
            employeeId: 42,
        });
        // Назначение содержит тип движения, период и ФИО (PRD 3, «В скоупе»).
        expect(createCalls[0].purpose).toContain('Аванс');
        expect(createCalls[0].purpose).toContain('2026-07');
        expect(createCalls[0].purpose).toContain('Петров');

        const document = await payoutCashboxRecordRepo.findByTransactionId(
            response.id,
        );
        expect(document).toMatchObject({
            externalId: 'erp-ext-1',
            kind: 'OUTCOME',
            amount: 3000,
            system: 'ROAPP',
        });
    });

    it('приход (BONUS) с erpSyncRequired: true создаёт документ ERP типа INCOME', async () => {
        const createCalls: CreateErpCashDocumentParams[] = [];
        const erpPort: ErpCashDocumentPort = {
            create: (params) => {
                createCalls.push(params);
                return Promise.resolve({ externalId: 'erp-ext-2' });
            },
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const { handler } = build({ erpPort });

        await withRequestContext(() =>
            handler.execute(
                command({ type: 'BONUS', amount: 1000, erpSyncRequired: true }),
            ),
        );

        expect(createCalls[0].kind).toBe(
            'INCOME' satisfies ErpCashDocumentKind,
        );
    });

    it('ошибка ERP при создании — движение не создаётся, документ ERP не создаётся', async () => {
        const erpPort: ErpCashDocumentPort = {
            create: () => Promise.reject(new Error('RemOnline недоступен')),
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, payoutCashboxRecordRepo } = build({
            erpPort,
        });

        await expect(
            withRequestContext(() =>
                handler.execute(
                    command({
                        type: 'ADVANCE',
                        amount: 1000,
                        erpSyncRequired: true,
                    }),
                ),
            ),
        ).rejects.toThrow('RemOnline недоступен');

        expect(transactionRepo.store.size).toBe(0);
        expect(payoutCashboxRecordRepo.store.size).toBe(0);
    });

    it('успех ERP + сбой записи в БД → компенсация: документ ERP удаляется, исходная ошибка пробрасывается', async () => {
        const deleteCalls: DeleteErpCashDocumentParams[] = [];
        const erpPort: ErpCashDocumentPort = {
            create: () => Promise.resolve({ externalId: 'erp-ext-3' }),
            delete: (params) => {
                deleteCalls.push(params);
                return Promise.resolve();
            },
            findByKey: () => Promise.resolve(null),
        };
        const dbError = new Error('БД недоступна');
        const unitOfWork: UnitOfWorkPort = {
            run: () => Promise.reject(dbError),
        };
        const { handler, transactionRepo, payoutCashboxRecordRepo } = build({
            erpPort,
            unitOfWork,
        });

        await expect(
            withRequestContext(() =>
                handler.execute(
                    command({
                        type: 'ADVANCE',
                        amount: 1000,
                        erpSyncRequired: true,
                    }),
                ),
            ),
        ).rejects.toThrow(dbError);

        expect(transactionRepo.store.size).toBe(0);
        expect(payoutCashboxRecordRepo.store.size).toBe(0);
        expect(deleteCalls).toEqual([
            { externalId: 'erp-ext-3', kind: 'OUTCOME', amount: 1000 },
        ]);
    });

    // ====== erpSyncRequired: true — оба направления (общий хендлер, PRD 3) ====== //
    // Хендлер общий на service/shop (см. WHY в шапке файла хендлера) — эти
    // тесты проверяют, что выбор порта по command.direction реально работает,
    // а не только что оба токена внедрены в конструктор.

    it('direction: shop с erpSyncRequired — вызывает SHOP-порт (не service), документ ERP системы MOY_SKLAD', async () => {
        const serviceCalls: CreateErpCashDocumentParams[] = [];
        const shopCalls: CreateErpCashDocumentParams[] = [];
        const serviceErpPort: ErpCashDocumentPort = {
            create: (params) => {
                serviceCalls.push(params);
                return Promise.resolve({
                    externalId: 'roapp-should-not-happen',
                });
            },
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const shopErpPort: ErpCashDocumentPort = {
            create: (params) => {
                shopCalls.push(params);
                return Promise.resolve({ externalId: 'ms-ext-1' });
            },
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, payoutCashboxRecordRepo } = build({
            erpPort: serviceErpPort,
            shopErpPort,
        });

        const response = await withRequestContext(() =>
            handler.execute(
                command({
                    direction: 'shop',
                    type: 'ADVANCE',
                    amount: 2000,
                    erpSyncRequired: true,
                }),
            ),
        );

        expect(serviceCalls).toHaveLength(0);
        expect(shopCalls).toHaveLength(1);
        expect(response.direction).toBe('shop');

        const document = await payoutCashboxRecordRepo.findByTransactionId(
            response.id,
        );
        expect(document).toMatchObject({
            system: 'MOY_SKLAD',
            externalId: 'ms-ext-1',
        });
        expect(transactionRepo.store.size).toBe(1);
    });

    it('direction: shop, ошибка SHOP-порта — движение не создаётся, SERVICE-порт не вызывается', async () => {
        const serviceCalls: CreateErpCashDocumentParams[] = [];
        const serviceErpPort: ErpCashDocumentPort = {
            create: (params) => {
                serviceCalls.push(params);
                return Promise.resolve({
                    externalId: 'roapp-should-not-happen',
                });
            },
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const shopErpPort: ErpCashDocumentPort = {
            create: () => Promise.reject(new Error('МойСклад недоступен')),
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, payoutCashboxRecordRepo } = build({
            erpPort: serviceErpPort,
            shopErpPort,
        });

        await expect(
            withRequestContext(() =>
                handler.execute(
                    command({
                        direction: 'shop',
                        type: 'ADVANCE',
                        amount: 2000,
                        erpSyncRequired: true,
                    }),
                ),
            ),
        ).rejects.toThrow('МойСклад недоступен');

        expect(serviceCalls).toHaveLength(0);
        expect(transactionRepo.store.size).toBe(0);
        expect(payoutCashboxRecordRepo.store.size).toBe(0);
    });

    // ====== PAID по остатку — «ручной приход» как способ закрытия (PRD 3) ====== //
    // «Документы... переходят в PAID, когда остаток... ≤ 0 — независимо от
    // того, чем он закрыт: выплатой, ручным приходом... или их комбинацией»
    // (PRD 3, «В скоупе»); критерий готовности требует тест «на оба способа
    // закрытия» — здесь способ «ручное движение», выплата покрыта
    // create-payout.handler.spec.ts.

    // Документ в статусе ACCRUED (все строки проведены) — то состояние, из
    // которого markPaid() вообще достижим (см. SalaryAccrual.markPaid и
    // salary-accrual.entity.spec.ts, «PAID (PRD 3, Фаза 12)»).
    const buildAccrual = () => {
        const accrual = withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 4000,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        amount: 4000,
                        sources: [],
                    },
                ],
            }),
        );
        withRequestContext(() => accrual.accrueLine(accrual.lines[0].id));
        return accrual;
    };

    it('ручное движение (не выплата), закрывающее остаток ≤ 0, переводит ACCRUED-документы сотрудника в PAID (erpSyncRequired: false)', async () => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const accrual = buildAccrual();
        accrualRepo.store.set(accrual.id, accrual);
        const { handler, transactionRepo } = build({ accrualRepo });

        // Приход (BONUS) +4000 — остаток положителен, документ остаётся
        // ACCRUED («выплачено частично» по факту нулевой выплаты).
        await withRequestContext(() =>
            handler.execute(
                command({
                    type: 'BONUS',
                    amount: 4000,
                    erpSyncRequired: false,
                }),
            ),
        );
        expect((await accrualRepo.findById(accrual.id))!.status).toBe(
            'ACCRUED',
        );

        // Аванс -5000 уводит остаток в минус (-1000 ≤ 0) — документ переходит
        // в PAID, хотя выплаты (PAYOUT) не было вовсе: «независимо от того,
        // чем он закрыт... ручным приходом... или их комбинацией» (PRD 3).
        await withRequestContext(() =>
            handler.execute(
                command({
                    type: 'ADVANCE',
                    amount: 5000,
                    erpSyncRequired: false,
                }),
            ),
        );

        await expect(transactionRepo.sumByEmployee(42)).resolves.toBe(-1000);
        const updated = await accrualRepo.findById(accrual.id);
        expect(updated!.status).toBe('PAID');
        expect(updated!.lines.every((line) => line.status === 'PAID')).toBe(
            true,
        );
    });

    it('то же закрытие остатка ≤ 0 через ручное движение с erpSyncRequired: true тоже переводит ACCRUED в PAID', async () => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const accrual = buildAccrual();
        accrualRepo.store.set(accrual.id, accrual);
        const { handler, accrualRepo: usedRepo } = build({ accrualRepo });

        await withRequestContext(() =>
            handler.execute(
                command({
                    type: 'ADVANCE',
                    amount: 4000,
                    erpSyncRequired: true,
                }),
            ),
        );

        expect((await usedRepo.findById(accrual.id))!.status).toBe('PAID');
    });

    it('пока остаток > 0, ручное движение НЕ переводит документ в PAID', async () => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const accrual = buildAccrual();
        accrualRepo.store.set(accrual.id, accrual);
        const { handler } = build({ accrualRepo });

        await withRequestContext(() =>
            handler.execute(
                command({
                    type: 'BONUS',
                    amount: 1000,
                    erpSyncRequired: false,
                }),
            ),
        );

        expect((await accrualRepo.findById(accrual.id))!.status).toBe(
            'ACCRUED',
        );
    });
});
