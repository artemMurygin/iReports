import { CalculateShopSnapshotRowsService } from '@/domains/shop/modules/accounting/application/services/calculation/calculate-snapshot-rows.service';
import { ErpSyncFailedException } from '@/shared/application/exceptions/erp-sync-failed.exception';
import {
    ShopPeriodNotExpiredException,
    ShopUnapprovedSalesPlanRowsException,
} from '@/domains/shop/modules/accounting/domain/exceptions/accounting-period.exception';
import { ErpPeriodSyncRunner } from '@/shared/application/services/erp-period-sync-runner.service';
import { CloseShopAccountingPeriodHandler } from './close-accounting-period.handler';
import { CloseShopAccountingPeriodCommand } from './close-accounting-period.command';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { ShopAccountingPeriodSnapshotPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { ShopAccountingCalculationCachePort } from '@/domains/shop/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import type { ShopSalesPlanRepositoryPort } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import type { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/calculation/build-calculation-context.service';
import { Period } from '@/shared/domain/period.value-object';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ShopSalesPlan } from '@/domains/shop/modules/sales/domain/entities/sales-plan.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { EmployeeDismissalPort } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import { InMemoryShopSalaryAccrualRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { SalaryAccrualDocumentsCreatedDomainEvent } from '@/shared/domain/events/salary-accrual-documents-created.domain-event';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';

// Зеркало domains/service/modules/accounting/application/command/
// close-accounting-period.handler.spec.ts (только shop-кейсы) — независимый
// тест для независимого хендлера CloseShopAccountingPeriodHandler (Фаза
// 13.5, issue #57).
describe('CloseShopAccountingPeriodHandler', () => {
    const buildHandler = (overrides?: {
        plans?: ShopSalesPlan[];
        shopSchemas?: ShopMotivationSchema[];
        dismissedEmployeeIds?: number[];
        failSnapshotSave?: boolean;
        // Ошибка на последнем шаге транзакции — ПОСЛЕ записи документов
        // (повторный сброс кэша внутри unitOfWork.run): проверяет, что уже
        // записанные документы откатываются вместе со всем остальным.
        failAfterAccrualsSaved?: boolean;
        hoursWorked?: () => number;
        // Замоканная ERP (Фаза 2 PRD 1): синк по требованию перед расчётом.
        syncPeriod?: jest.Mock;
    }) => {
        const save = jest.fn().mockResolvedValue(undefined);
        const findByPeriod = jest.fn().mockResolvedValue(null);
        const periodRepo: ShopAccountingPeriodRepositoryPort = {
            findByPeriod,
            save,
        };

        const saveAll = jest
            .fn()
            .mockImplementation(() =>
                overrides?.failSnapshotSave
                    ? Promise.reject(new Error('БД недоступна'))
                    : Promise.resolve(undefined),
            );
        const snapshotRepo: ShopAccountingPeriodSnapshotPort = {
            saveAll,
            findByKey: jest.fn(),
            findManyByKey: jest.fn().mockResolvedValue(new Map()),
            deleteByPeriod: jest.fn(),
        };

        const deleteCacheByPeriod = jest
            .fn()
            .mockImplementation(() =>
                overrides?.failAfterAccrualsSaved &&
                deleteCacheByPeriod.mock.calls.length > 1
                    ? Promise.reject(new Error('БД недоступна после записи'))
                    : Promise.resolve(undefined),
            );
        const cacheRepo: ShopAccountingCalculationCachePort = {
            find: jest.fn(),
            upsert: jest.fn(),
            deleteByPeriod: deleteCacheByPeriod,
        };

        const shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn(),
            findAllEmployeeTargets: jest
                .fn()
                .mockResolvedValue(overrides?.shopSchemas ?? []),
            // Схем на отдел в этих тестах нет — forAllTargets() сводится
            // ровно к findAllEmployeeTargets(), как и раньше (покрытие
            // разворачивания department-схемы в сотрудников — в
            // resolve-employee-salary-rules.service.spec.ts).
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn(),
            initializeName: jest.fn(),
        };

        const directoryRepo = {
            findServiceAccountEmployeeIds: () =>
                Promise.resolve(new Set<number>()),
        } as unknown as DirectoryRepositoryPort;
        const salaryRulesResolver = new ResolveShopEmployeeSalaryRulesService(
            shopMotivationSchemaRepo,
            {
                findEmployeeDepartmentId: jest.fn().mockResolvedValue(null),
                findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
            } as unknown as ShopCalculationDataPort,
            directoryRepo,
        );

        const salesPlanRepo: ShopSalesPlanRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByPeriod: jest.fn().mockResolvedValue(overrides?.plans ?? []),
        };

        // Фейковый UnitOfWork с откатом (см. одноимённый спек сервиса).
        const accrualRepo = new InMemoryShopSalaryAccrualRepository();
        const unitOfWork: UnitOfWorkPort = {
            run: async (work) => {
                const before = new Map(accrualRepo.store);
                try {
                    return await work();
                } catch (error) {
                    accrualRepo.store.clear();
                    for (const [id, accrual] of before) {
                        accrualRepo.store.set(id, accrual);
                    }
                    throw error;
                }
            },
        };

        const employeeDismissal: EmployeeDismissalPort = {
            findDismissedEmployeeIds: jest.fn((ids: number[]) =>
                Promise.resolve(
                    new Set(
                        ids.filter((id) =>
                            (overrides?.dismissedEmployeeIds ?? []).includes(
                                id,
                            ),
                        ),
                    ),
                ),
            ),
        };

        const emitAsync = jest.fn().mockResolvedValue([]);
        const eventEmitter = { emitAsync } as unknown as EventEmitter2;

        const build = jest.fn((period: Period, employeeId: number) =>
            Promise.resolve({
                employee: { id: employeeId, identities: [] },
                period: {
                    direction: 'shop' as const,
                    period: period.getValue(),
                    ...period.getBounds(),
                    status: 'OPEN' as const,
                },
                erpData: {
                    hoursWorked: {
                        fact: overrides?.hoursWorked?.() ?? 8,
                        prognose: overrides?.hoursWorked?.() ?? 8,
                    },
                },
                salesPerformanceDetail: null,
                // Карта по категориям (Фаза 2 плана
                // shop-sales-performance-by-category) — здесь всегда
                // пустая, ни один тест этого файла не использует
                // FloatPercent-правила.
                salesPerformanceByCategory: new Map(),
            }),
        );
        const shopContextBuilder = {
            build,
        } as unknown as BuildShopCalculationContextService;

        const syncPeriod =
            overrides?.syncPeriod ?? jest.fn().mockResolvedValue(undefined);
        const erpSync = new ErpPeriodSyncRunner({ syncPeriod });

        const handler = new CloseShopAccountingPeriodHandler(
            periodRepo,
            snapshotRepo,
            cacheRepo,
            salesPlanRepo,
            accrualRepo,
            employeeDismissal,
            unitOfWork,
            eventEmitter,
            new CalculateShopSnapshotRowsService(
                shopContextBuilder,
                salaryRulesResolver,
            ),
            erpSync,
        );

        return {
            handler,
            save,
            saveAll,
            deleteCacheByPeriod,
            periodRepo,
            shopContextBuilder,
            accrualRepo,
            emitAsync,
            build,
            syncPeriod,
        };
    };

    const buildHourlySchema = (targetId: number, price = 250) =>
        withRequestContext(() => {
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ONLINE_MANAGER',
                config: { price },
            });
            return ShopMotivationSchema.create({
                targetType: 'Employee',
                targetId,
                name: 'Оклад продавца',
                rules: [rule],
            });
        });

    const buildApprovedPlan = () =>
        withRequestContext(() => {
            const plan = ShopSalesPlan.create({
                department: 1,
                category: null,
                period: '2026-07',
                turnover: 1000,
                margin: 100,
                source: 'MANUAL',
            });
            plan.approve(1);
            return plan;
        });

    it('отклоняется со списком неутверждённых строк плана', async () => {
        const unapprovedPlan = withRequestContext(() =>
            ShopSalesPlan.create({
                department: 1,
                category: null,
                period: '2026-07',
                turnover: 1000,
                margin: 100,
                source: 'MANUAL',
            }),
        );
        const { handler, save } = buildHandler({ plans: [unapprovedPlan] });

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new CloseShopAccountingPeriodCommand({
                        period: '2026-07',
                        closedBy: 1,
                    }),
                ),
            ),
        ).rejects.toThrow(ShopUnapprovedSalesPlanRowsException);
        expect(save).not.toHaveBeenCalled();
    });

    it('при успехе строит снапшот через shopMotivationSchemaRepo/shopContextBuilder и закрывает период', async () => {
        const schema = withRequestContext(() => {
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ONLINE_MANAGER',
                config: { price: 250 },
            });
            return ShopMotivationSchema.create({
                targetType: 'Employee',
                targetId: 42,
                name: 'Оклад продавца',
                rules: [rule],
            });
        });
        const { handler, save, saveAll, deleteCacheByPeriod } = buildHandler({
            plans: [buildApprovedPlan()],
            shopSchemas: [schema],
        });

        const response = await withRequestContext(() =>
            handler.execute(
                new CloseShopAccountingPeriodCommand({
                    period: '2026-07',
                    closedBy: 7,
                }),
            ),
        );

        expect(response.status).toBe('CLOSED');
        expect(response.closedBy).toBe(7);
        expect(save).toHaveBeenCalledTimes(1);
        expect(saveAll).toHaveBeenCalledTimes(1);
        const [, , rows] = saveAll.mock.calls[0] as [
            string,
            string,
            { employeeId: number; total: number }[],
        ];
        expect(rows).toEqual([
            expect.objectContaining({ employeeId: 42, total: 2000 }),
        ]);
        expect(deleteCacheByPeriod).toHaveBeenCalledWith('2026-07');
    });

    it('пустой список планов (плана вообще нет) не блокирует закрытие', async () => {
        const { handler, save } = buildHandler({ plans: [] });

        const response = await withRequestContext(() =>
            handler.execute(
                new CloseShopAccountingPeriodCommand({
                    period: '2026-07',
                    closedBy: 1,
                }),
            ),
        );

        expect(response.status).toBe('CLOSED');
        expect(save).toHaveBeenCalledTimes(1);
    });

    // PRD 1 docs/payroll-closing-and-accrual — документы начисления при
    // закрытии периода магазина (Фаза 1), зеркало одноимённого блока в
    // спеке сервиса.
    describe('документы начисления', () => {
        it('создаёт документ DRAFT на каждого сотрудника снапшота — включая нулевого и уволенного', async () => {
            const { handler, accrualRepo, saveAll } = buildHandler({
                plans: [buildApprovedPlan()],
                shopSchemas: [
                    buildHourlySchema(42),
                    buildHourlySchema(43),
                    buildHourlySchema(44, 0),
                ],
                dismissedEmployeeIds: [43],
            });

            await withRequestContext(() =>
                handler.execute(
                    new CloseShopAccountingPeriodCommand({
                        period: '2026-07',
                        closedBy: 7,
                    }),
                ),
            );

            const [, , rows] = saveAll.mock.calls[0] as [
                string,
                string,
                {
                    employeeId: number;
                    total: number;
                    lines: { ruleId: string; amount: number }[];
                }[],
            ];
            const accruals = await accrualRepo.findByPeriod('2026-07');
            expect(accruals).toHaveLength(3);
            expect(accruals).toHaveLength(rows.length);
            for (const row of rows) {
                const accrual = accruals.find(
                    (item) => item.employeeId === row.employeeId,
                );
                expect(accrual).toBeDefined();
                expect(accrual?.status).toBe('DRAFT');
                expect(accrual?.direction).toBe('shop');
                expect(accrual?.total).toBe(row.total);
                expect(
                    accrual?.lines.map((line) => ({
                        ruleId: line.ruleId,
                        amount: line.amount,
                    })),
                ).toEqual(
                    row.lines.map((line) => ({
                        ruleId: line.ruleId,
                        amount: line.amount,
                    })),
                );
            }
            const byEmployee = new Map(
                accruals.map((accrual) => [accrual.employeeId, accrual]),
            );
            expect(byEmployee.get(42)?.total).toBe(2000);
            expect(byEmployee.get(42)?.isDismissed).toBe(false);
            expect(byEmployee.get(43)?.isDismissed).toBe(true);
            expect(byEmployee.get(44)?.total).toBe(0);
            expect(byEmployee.get(44)?.lines).toHaveLength(1);
        });

        it('публикует SalaryAccrualDocumentsCreatedDomainEvent направления shop', async () => {
            const { handler, accrualRepo, emitAsync } = buildHandler({
                plans: [buildApprovedPlan()],
                shopSchemas: [buildHourlySchema(42)],
            });

            await withRequestContext(() =>
                handler.execute(
                    new CloseShopAccountingPeriodCommand({
                        period: '2026-07',
                        closedBy: 7,
                    }),
                ),
            );

            expect(emitAsync).toHaveBeenCalledTimes(1);
            const [name, event] = emitAsync.mock.calls[0] as [
                string,
                SalaryAccrualDocumentsCreatedDomainEvent,
            ];
            expect(name).toBe('SalaryAccrualDocumentsCreatedDomainEvent');
            expect(event.direction).toBe('shop');
            expect(event.period).toBe('2026-07');
            expect(event.accrualIds).toEqual([...accrualRepo.store.keys()]);
        });

        it('сбрасывает кэш до расчёта — изменённые после прогрева данные попадают в документ', async () => {
            let hours = 8;
            const { handler, accrualRepo, deleteCacheByPeriod, build } =
                buildHandler({
                    plans: [buildApprovedPlan()],
                    shopSchemas: [buildHourlySchema(42)],
                    hoursWorked: () => hours,
                });
            hours = 10;

            await withRequestContext(() =>
                handler.execute(
                    new CloseShopAccountingPeriodCommand({
                        period: '2026-07',
                        closedBy: 7,
                    }),
                ),
            );

            const cacheResetOrder =
                deleteCacheByPeriod.mock.invocationCallOrder[0];
            const buildOrder = build.mock.invocationCallOrder[0];
            expect(cacheResetOrder).toBeLessThan(buildOrder);
            const [accrual] = await accrualRepo.findByPeriod('2026-07');
            expect(accrual.total).toBe(2500);
        });

        it('ошибка внутри транзакции — документов нет, событие не опубликовано', async () => {
            const { handler, accrualRepo, emitAsync } = buildHandler({
                plans: [buildApprovedPlan()],
                shopSchemas: [buildHourlySchema(42)],
                failSnapshotSave: true,
            });

            await expect(
                withRequestContext(() =>
                    handler.execute(
                        new CloseShopAccountingPeriodCommand({
                            period: '2026-07',
                            closedBy: 7,
                        }),
                    ),
                ),
            ).rejects.toThrow('БД недоступна');

            expect(accrualRepo.store.size).toBe(0);
            expect(emitAsync).not.toHaveBeenCalled();
        });

        it('ошибка после записи документов внутри транзакции — документы откатываются, событие не опубликовано', async () => {
            const { handler, accrualRepo, emitAsync, saveAll } = buildHandler({
                plans: [buildApprovedPlan()],
                shopSchemas: [buildHourlySchema(42), buildHourlySchema(43)],
                failAfterAccrualsSaved: true,
            });

            await expect(
                withRequestContext(() =>
                    handler.execute(
                        new CloseShopAccountingPeriodCommand({
                            period: '2026-07',
                            closedBy: 7,
                        }),
                    ),
                ),
            ).rejects.toThrow('БД недоступна после записи');

            // Снапшот и документы успели записаться внутри транзакции —
            // после отката их нет, событие не уходит.
            expect(saveAll).toHaveBeenCalledTimes(1);
            expect(accrualRepo.store.size).toBe(0);
            expect(emitAsync).not.toHaveBeenCalled();
        });
    });

    // Фаза 2 PRD 1 docs/payroll-closing-and-accrual — зеркально сервису.
    describe('неявная синхронизация ERP и ограничения закрытия', () => {
        it('вызывает синк отгрузок до расчёта — свежие данные ERP попадают в снапшот и документ', async () => {
            let hours = 8;
            const syncPeriod = jest.fn().mockImplementation(() => {
                hours = 10;
                return Promise.resolve();
            });
            const { handler, accrualRepo, build } = buildHandler({
                plans: [buildApprovedPlan()],
                shopSchemas: [buildHourlySchema(42)],
                hoursWorked: () => hours,
                syncPeriod,
            });

            await withRequestContext(() =>
                handler.execute(
                    new CloseShopAccountingPeriodCommand({
                        period: '2026-07',
                        closedBy: 7,
                    }),
                ),
            );

            expect(syncPeriod).toHaveBeenCalledTimes(1);
            expect(syncPeriod.mock.invocationCallOrder[0]).toBeLessThan(
                build.mock.invocationCallOrder[0],
            );
            const [accrual] = await accrualRepo.findByPeriod('2026-07');
            expect(accrual.total).toBe(2500);
        });

        it('ошибка синка ERP → 409 ErpSyncFailedException, период открыт, ничего не создано', async () => {
            const { handler, save, saveAll, accrualRepo, emitAsync } =
                buildHandler({
                    plans: [buildApprovedPlan()],
                    shopSchemas: [buildHourlySchema(42)],
                    syncPeriod: jest
                        .fn()
                        .mockRejectedValue(new Error('МойСклад недоступен')),
                });

            await expect(
                withRequestContext(() =>
                    handler.execute(
                        new CloseShopAccountingPeriodCommand({
                            period: '2026-07',
                            closedBy: 7,
                        }),
                    ),
                ),
            ).rejects.toBeInstanceOf(ErpSyncFailedException);

            expect(save).not.toHaveBeenCalled();
            expect(saveAll).not.toHaveBeenCalled();
            expect(accrualRepo.store.size).toBe(0);
            expect(emitAsync).not.toHaveBeenCalled();
        });

        it('текущий месяц → 409 PeriodNotExpiredException, синк не вызывается', async () => {
            const syncPeriod = jest.fn().mockResolvedValue(undefined);
            const { handler } = buildHandler({
                plans: [buildApprovedPlan()],
                syncPeriod,
            });

            await expect(
                withRequestContext(() =>
                    handler.execute(
                        new CloseShopAccountingPeriodCommand({
                            period: Period.current().getValue(),
                            closedBy: 7,
                        }),
                    ),
                ),
            ).rejects.toBeInstanceOf(ShopPeriodNotExpiredException);

            expect(syncPeriod).not.toHaveBeenCalled();
        });
    });
});
