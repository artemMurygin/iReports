import { CloseAccountingPeriodHandler } from './close-accounting-period.handler';
import { CloseAccountingPeriodCommand } from './close-accounting-period.command';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/calculation/service-calculation-data.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import type { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/calculation/build-service-calculation-context.service';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { Period } from '@/shared/domain/period.value-object';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { UnapprovedSalesPlanRowsException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { EmployeeDismissalPort } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { CalculateServiceSnapshotRowsService } from '@/domains/service/modules/accounting/application/services/calculation/calculate-service-snapshot-rows.service';
import { ErpPeriodSyncRunner } from '@/shared/application/services/erp-period-sync-runner.service';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import {
    PeriodAlreadyClosedException,
    PeriodNotExpiredException,
} from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { ErpSyncFailedException } from '@/shared/application/exceptions/erp-sync-failed.exception';
import { SalaryAccrualDocumentsCreatedDomainEvent } from '@/shared/domain/events/salary-accrual-documents-created.domain-event';

describe('CloseAccountingPeriodHandler', () => {
    const buildHandler = (overrides?: {
        plans?: SalesPlan[];
        schemas?: MotivationSchema[];
        dismissedEmployeeIds?: number[];
        // Инъекция ошибки в транзакцию закрытия (PRD 1: "всё или ничего").
        failSnapshotSave?: boolean;
        // Ошибка на последнем шаге транзакции — ПОСЛЕ записи документов
        // (повторный сброс кэша внутри unitOfWork.run): проверяет, что уже
        // записанные документы откатываются вместе со всем остальным.
        failAfterAccrualsSaved?: boolean;
        // Часы из контекста расчёта — изменяемы снаружи, чтобы проверить,
        // что закрытие считает по текущим данным, а не по прогретому кэшу.
        hoursWorked?: () => number;
        // Замоканная ERP (Фаза 2 PRD 1): синк по требованию перед расчётом.
        syncPeriod?: jest.Mock;
        existingPeriod?: AccountingPeriod | null;
    }) => {
        const save = jest.fn().mockResolvedValue(undefined);
        const findByDirectionAndPeriod = jest
            .fn()
            .mockResolvedValue(overrides?.existingPeriod ?? null);
        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod,
            save,
        };

        const saveAll = jest
            .fn()
            .mockImplementation(() =>
                overrides?.failSnapshotSave
                    ? Promise.reject(new Error('БД недоступна'))
                    : Promise.resolve(undefined),
            );
        const snapshotRepo: AccountingPeriodSnapshotPort = {
            saveAll,
            findByKey: jest.fn(),
            findManyByKey: jest.fn().mockResolvedValue(new Map()),
            deleteByDirectionAndPeriod: jest.fn(),
        };

        const deleteCacheByPeriod = jest
            .fn()
            .mockImplementation(() =>
                overrides?.failAfterAccrualsSaved &&
                deleteCacheByPeriod.mock.calls.length > 1
                    ? Promise.reject(new Error('БД недоступна после записи'))
                    : Promise.resolve(undefined),
            );
        const cacheRepo: AccountingCalculationCachePort = {
            find: jest.fn(),
            upsert: jest.fn(),
            deleteByDirectionAndPeriod: deleteCacheByPeriod,
        };

        const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn(),
            findAllEmployeeTargets: jest
                .fn()
                .mockResolvedValue(overrides?.schemas ?? []),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn(),
            initializeName: jest.fn(),
        };

        // ResolveEmployeeSalaryRulesService.forAllTargets() — единственный
        // легальный вход к правилам сотрудников для снапшота закрытия периода
        // (см. шапку resolve-employee-salary-rules.service.ts). Тесты этого
        // файла заводят только личные (Employee) схемы, поэтому
        // department-схем нет и findEmployeesInDepartment не вызывается.
        const calculationDataSource = {
            findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
        } as unknown as ServiceCalculationDataPort;
        // Ни один тест этого файла не заводит служебных аккаунтов
        // (docs/employee-ordering-and-salary-filter, Фаза 3) — пустое
        // множество.
        const directoryRepo = {
            findServiceAccountEmployeeIds: () =>
                Promise.resolve(new Set<number>()),
        } as unknown as DirectoryRepositoryPort;
        const salaryRulesResolver = new ResolveEmployeeSalaryRulesService(
            motivationSchemaRepo,
            calculationDataSource,
            directoryRepo,
        );

        const salesPlanRepo: SalesPlanRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByDirectionAndPeriod: jest
                .fn()
                .mockResolvedValue(overrides?.plans ?? []),
        };

        // Фейковый UnitOfWork с откатом: пока работа не завершилась
        // успешно, «зафиксированные» документы в accrualRepo не видны —
        // имитация транзакции Postgres для теста «всё или ничего».
        const accrualRepo = new InMemorySalaryAccrualRepository();
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
                    direction: 'service' as const,
                    period: period.getValue(),
                    ...period.getBounds(),
                    status: 'OPEN' as const,
                },
                erpData: {
                    serviceCompletedItems: [],
                    hoursWorked: {
                        fact: overrides?.hoursWorked?.() ?? 8,
                        prognose: overrides?.hoursWorked?.() ?? 8,
                    },
                },
                salesPerformanceDetail: null,
            }),
        );
        const contextBuilder = {
            build,
        } as unknown as BuildServiceCalculationContextService;

        const syncPeriod =
            overrides?.syncPeriod ?? jest.fn().mockResolvedValue(undefined);
        const erpSync = new ErpPeriodSyncRunner({ syncPeriod });

        const handler = new CloseAccountingPeriodHandler(
            periodRepo,
            snapshotRepo,
            cacheRepo,
            salesPlanRepo,
            accrualRepo,
            employeeDismissal,
            unitOfWork,
            eventEmitter,
            new CalculateServiceSnapshotRowsService(
                contextBuilder,
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
            accrualRepo,
            emitAsync,
            build,
            syncPeriod,
        };
    };

    const buildHourlySchema = (targetId: number, price = 250) =>
        withRequestContext(() => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price },
            });
            return MotivationSchema.create({
                targetType: 'Employee',
                targetId,
                name: 'Оклад инженера',
                rules: [rule],
            });
        });

    const buildApprovedPlan = () =>
        withRequestContext(() => {
            const plan = SalesPlan.create({
                direction: 'service',
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
            SalesPlan.create({
                direction: 'service',
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
                    new CloseAccountingPeriodCommand({
                        period: '2026-07',
                        closedBy: 1,
                    }),
                ),
            ),
        ).rejects.toThrow(UnapprovedSalesPlanRowsException);
        expect(save).not.toHaveBeenCalled();
    });

    it('при успехе создаёт снапшот по каждому сотруднику с личной схемой и закрывает период', async () => {
        const schema = withRequestContext(() => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 250 },
            });
            return MotivationSchema.create({
                targetType: 'Employee',
                targetId: 42,
                name: 'Оклад инженера',
                rules: [rule],
            });
        });
        const { handler, save, saveAll, deleteCacheByPeriod } = buildHandler({
            plans: [buildApprovedPlan()],
            schemas: [schema],
        });

        const response = await withRequestContext(() =>
            handler.execute(
                new CloseAccountingPeriodCommand({
                    period: '2026-07',
                    closedBy: 7,
                }),
            ),
        );

        expect(response.status).toBe('CLOSED');
        expect(response.closedBy).toBe(7);
        expect(save).toHaveBeenCalledTimes(1);
        expect(saveAll).toHaveBeenCalledTimes(1);
        const [, , , rows] = saveAll.mock.calls[0] as [
            string,
            string,
            string,
            { employeeId: number; total: number }[],
        ];
        expect(rows).toEqual([
            expect.objectContaining({ employeeId: 42, total: 2000 }),
        ]);
        expect(deleteCacheByPeriod).toHaveBeenCalledWith('service', '2026-07');
    });

    it('пустой список планов (плана вообще нет) не блокирует закрытие', async () => {
        const { handler, save } = buildHandler({ plans: [] });

        const response = await withRequestContext(() =>
            handler.execute(
                new CloseAccountingPeriodCommand({
                    period: '2026-07',
                    closedBy: 1,
                }),
            ),
        );

        expect(response.status).toBe('CLOSED');
        expect(save).toHaveBeenCalledTimes(1);
    });

    // PRD 1 docs/payroll-closing-and-accrual — документы начисления при
    // закрытии (Фаза 1).
    describe('документы начисления', () => {
        it('создаёт документ DRAFT на каждого сотрудника снапшота — включая нулевого и уволенного', async () => {
            const { handler, accrualRepo, saveAll } = buildHandler({
                plans: [buildApprovedPlan()],
                // 42 — обычный, 43 — уволен, 44 — нулевая ставка (0 ₽)
                schemas: [
                    buildHourlySchema(42),
                    buildHourlySchema(43),
                    buildHourlySchema(44, 0),
                ],
                dismissedEmployeeIds: [43],
            });

            await withRequestContext(() =>
                handler.execute(
                    new CloseAccountingPeriodCommand({
                        period: '2026-07',
                        closedBy: 7,
                    }),
                ),
            );

            const [, , , rows] = saveAll.mock.calls[0] as [
                string,
                string,
                string,
                {
                    employeeId: number;
                    total: number;
                    lines: { ruleId: string; amount: number }[];
                }[],
            ];
            const accruals = await accrualRepo.findByDirectionAndPeriod(
                'service',
                '2026-07',
            );
            expect(accruals).toHaveLength(rows.length);
            expect(accruals).toHaveLength(3);

            for (const row of rows) {
                const accrual = accruals.find(
                    (item) => item.employeeId === row.employeeId,
                );
                expect(accrual).toBeDefined();
                expect(accrual!.status).toBe('DRAFT');
                expect(accrual!.direction).toBe('service');
                expect(accrual!.period).toBe('2026-07');
                // Сумма документа = total снапшота, строки = lines снапшота
                // один в один (правило, сумма, порядок).
                expect(accrual!.total).toBe(row.total);
                expect(
                    accrual!.lines.map((line) => ({
                        ruleId: line.ruleId,
                        amount: line.amount,
                        originalAmount: line.originalAmount,
                        status: line.status,
                    })),
                ).toEqual(
                    row.lines.map((line) => ({
                        ruleId: line.ruleId,
                        amount: line.amount,
                        originalAmount: line.amount,
                        status: 'DRAFT',
                    })),
                );
            }

            const byEmployee = new Map(
                accruals.map((accrual) => [accrual.employeeId, accrual]),
            );
            expect(byEmployee.get(42)!.total).toBe(2000);
            expect(byEmployee.get(42)!.isDismissed).toBe(false);
            expect(byEmployee.get(43)!.isDismissed).toBe(true);
            expect(byEmployee.get(44)!.total).toBe(0);
            expect(byEmployee.get(44)!.lines).toHaveLength(1);
        });

        it('публикует SalaryAccrualDocumentsCreatedDomainEvent с перечнем accrualId после закрытия', async () => {
            const { handler, accrualRepo, emitAsync } = buildHandler({
                plans: [buildApprovedPlan()],
                schemas: [buildHourlySchema(42), buildHourlySchema(43)],
            });

            await withRequestContext(() =>
                handler.execute(
                    new CloseAccountingPeriodCommand({
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
            expect(event).toBeInstanceOf(
                SalaryAccrualDocumentsCreatedDomainEvent,
            );
            expect(event.direction).toBe('service');
            expect(event.period).toBe('2026-07');
            expect([...event.accrualIds].sort()).toEqual(
                [...accrualRepo.store.keys()].sort(),
            );
        });

        it('сбрасывает кэш периода до расчёта — данные, изменившиеся после прогрева, попадают в снапшот и документ', async () => {
            let hours = 8;
            const { handler, accrualRepo, deleteCacheByPeriod, build } =
                buildHandler({
                    plans: [buildApprovedPlan()],
                    schemas: [buildHourlySchema(42)],
                    hoursWorked: () => hours,
                });
            // «Прогрев кэша»: пока часов 8, затем данные меняются — закрытие
            // должно увидеть 10 часов, а не то, что было до изменения.
            hours = 10;

            await withRequestContext(() =>
                handler.execute(
                    new CloseAccountingPeriodCommand({
                        period: '2026-07',
                        closedBy: 7,
                    }),
                ),
            );

            // Кэш сброшен раньше, чем собран контекст расчёта.
            expect(deleteCacheByPeriod).toHaveBeenCalledWith(
                'service',
                '2026-07',
            );
            const cacheResetOrder =
                deleteCacheByPeriod.mock.invocationCallOrder[0];
            const buildOrder = build.mock.invocationCallOrder[0];
            expect(cacheResetOrder).toBeLessThan(buildOrder);

            const [accrual] = await accrualRepo.findByDirectionAndPeriod(
                'service',
                '2026-07',
            );
            expect(accrual.total).toBe(2500);
        });

        it('ошибка внутри транзакции закрытия — период остаётся открытым, документов нет, событие не опубликовано', async () => {
            const { handler, accrualRepo, emitAsync, periodRepo } =
                buildHandler({
                    plans: [buildApprovedPlan()],
                    schemas: [buildHourlySchema(42)],
                    failSnapshotSave: true,
                });

            await expect(
                withRequestContext(() =>
                    handler.execute(
                        new CloseAccountingPeriodCommand({
                            period: '2026-07',
                            closedBy: 7,
                        }),
                    ),
                ),
            ).rejects.toThrow('БД недоступна');

            expect(accrualRepo.store.size).toBe(0);
            expect(emitAsync).not.toHaveBeenCalled();
            // Репозиторий периода — мок без состояния: запись в БД
            // откатывается транзакцией, здесь проверяем, что никаких
            // действий после отката хендлер не делает (периода в OPEN-
            // состоянии у фейка и не было).
            await expect(
                periodRepo.findByDirectionAndPeriod('service', '2026-07'),
            ).resolves.toBeNull();
        });

        it('ошибка после записи документов внутри транзакции — документы откатываются, событие не опубликовано', async () => {
            const { handler, accrualRepo, emitAsync, saveAll } = buildHandler({
                plans: [buildApprovedPlan()],
                schemas: [buildHourlySchema(42), buildHourlySchema(43)],
                failAfterAccrualsSaved: true,
            });

            await expect(
                withRequestContext(() =>
                    handler.execute(
                        new CloseAccountingPeriodCommand({
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

    // Фаза 2 PRD 1 docs/payroll-closing-and-accrual: неявная синхронизация
    // ERP перед расчётом и ограничение "только истёкший месяц".
    describe('неявная синхронизация ERP и ограничения закрытия', () => {
        it('вызывает синк ERP до расчёта — заказ, появившийся в ERP после тика крона, попадает в снапшот и документ', async () => {
            // "ERP" — источник часов: до синка в локальной БД 8 часов, синк
            // дотягивает свежие данные (10 часов), расчёт видит уже их.
            let hours = 8;
            const syncPeriod = jest.fn().mockImplementation(() => {
                hours = 10;
                return Promise.resolve();
            });
            const { handler, accrualRepo, build, deleteCacheByPeriod } =
                buildHandler({
                    plans: [buildApprovedPlan()],
                    schemas: [buildHourlySchema(42)],
                    hoursWorked: () => hours,
                    syncPeriod,
                });

            await withRequestContext(() =>
                handler.execute(
                    new CloseAccountingPeriodCommand({
                        period: '2026-07',
                        closedBy: 7,
                    }),
                ),
            );

            expect(syncPeriod).toHaveBeenCalledTimes(1);
            expect(syncPeriod).toHaveBeenCalledWith(Period.create('2026-07'));
            // Порядок: синк → сброс кэша → сборка контекста расчёта.
            expect(syncPeriod.mock.invocationCallOrder[0]).toBeLessThan(
                deleteCacheByPeriod.mock.invocationCallOrder[0],
            );
            expect(syncPeriod.mock.invocationCallOrder[0]).toBeLessThan(
                build.mock.invocationCallOrder[0],
            );
            const [accrual] = await accrualRepo.findByDirectionAndPeriod(
                'service',
                '2026-07',
            );
            expect(accrual.total).toBe(2500);
        });

        it('ошибка синка ERP → 409 ErpSyncFailedException, период открыт, снапшот/документы не созданы, кэш не тронут', async () => {
            const syncPeriod = jest
                .fn()
                .mockRejectedValue(new Error('RemOnline недоступен'));
            const {
                handler,
                save,
                saveAll,
                accrualRepo,
                emitAsync,
                build,
                deleteCacheByPeriod,
            } = buildHandler({
                plans: [buildApprovedPlan()],
                schemas: [buildHourlySchema(42)],
                syncPeriod,
            });

            await expect(
                withRequestContext(() =>
                    handler.execute(
                        new CloseAccountingPeriodCommand({
                            period: '2026-07',
                            closedBy: 7,
                        }),
                    ),
                ),
            ).rejects.toBeInstanceOf(ErpSyncFailedException);

            expect(build).not.toHaveBeenCalled();
            expect(deleteCacheByPeriod).not.toHaveBeenCalled();
            expect(save).not.toHaveBeenCalled();
            expect(saveAll).not.toHaveBeenCalled();
            expect(accrualRepo.store.size).toBe(0);
            expect(emitAsync).not.toHaveBeenCalled();
        });

        it('текущий (ещё не истёкший) месяц → 409 PeriodNotExpiredException, синк не вызывается', async () => {
            const syncPeriod = jest.fn().mockResolvedValue(undefined);
            const { handler, save } = buildHandler({
                plans: [buildApprovedPlan()],
                schemas: [buildHourlySchema(42)],
                syncPeriod,
            });
            const current = Period.current().getValue();

            await expect(
                withRequestContext(() =>
                    handler.execute(
                        new CloseAccountingPeriodCommand({
                            period: current,
                            closedBy: 7,
                        }),
                    ),
                ),
            ).rejects.toBeInstanceOf(PeriodNotExpiredException);

            expect(syncPeriod).not.toHaveBeenCalled();
            expect(save).not.toHaveBeenCalled();
        });

        it('будущий месяц → 409 PeriodNotExpiredException', async () => {
            const { handler } = buildHandler({
                plans: [buildApprovedPlan()],
            });

            await expect(
                withRequestContext(() =>
                    handler.execute(
                        new CloseAccountingPeriodCommand({
                            period: '2099-01',
                            closedBy: 7,
                        }),
                    ),
                ),
            ).rejects.toBeInstanceOf(PeriodNotExpiredException);
        });

        it('уже закрытый период → 409 PeriodAlreadyClosedException до синка', async () => {
            const closed = withRequestContext(() => {
                const entity = AccountingPeriod.openFor({
                    direction: 'service',
                    period: '2026-07',
                });
                entity.close(1, 0);
                return entity;
            });
            const syncPeriod = jest.fn().mockResolvedValue(undefined);
            const { handler } = buildHandler({
                plans: [buildApprovedPlan()],
                syncPeriod,
                existingPeriod: closed,
            });

            await expect(
                withRequestContext(() =>
                    handler.execute(
                        new CloseAccountingPeriodCommand({
                            period: '2026-07',
                            closedBy: 7,
                        }),
                    ),
                ),
            ).rejects.toBeInstanceOf(PeriodAlreadyClosedException);

            expect(syncPeriod).not.toHaveBeenCalled();
        });
    });
});
