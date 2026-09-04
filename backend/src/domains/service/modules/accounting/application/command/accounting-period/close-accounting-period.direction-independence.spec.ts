import { CalculateServiceSnapshotRowsService } from '@/domains/service/modules/accounting/application/services/calculate-service-snapshot-rows.service';
import { ErpPeriodSyncRunner } from '@/shared/application/services/erp-period-sync-runner.service';
import { CalculateShopSnapshotRowsService } from '@/domains/shop/modules/accounting/application/services/calculation/calculate-snapshot-rows.service';
import { CloseAccountingPeriodHandler } from './close-accounting-period.handler';
import { CloseAccountingPeriodCommand } from './close-accounting-period.command';
import { CloseShopAccountingPeriodHandler } from '@/domains/shop/modules/accounting/application/command/accounting-period/close-accounting-period.handler';
import { CloseShopAccountingPeriodCommand } from '@/domains/shop/modules/accounting/application/command/accounting-period/close-accounting-period.command';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import { PeriodClosure } from '@/domains/service/modules/accounting/domain/value-objects/period-closure.value-object';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { ShopAccountingPeriodSnapshotPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { ShopAccountingCalculationCachePort } from '@/domains/shop/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import { ShopAccountingPeriod } from '@/domains/shop/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import { ShopPeriodClosure } from '@/domains/shop/modules/accounting/domain/value-objects/period-closure.value-object';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { ShopSalesPlanRepositoryPort } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import type { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/build-service-calculation-context.service';
import type { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/calculation/build-calculation-context.service';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import { Period } from '@/shared/domain/period.value-object';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { EmployeeDismissalPort } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { InMemoryShopSalaryAccrualRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';

// Ни один сценарий этого файла не заводит служебных аккаунтов
// (docs/employee-ordering-and-salary-filter, Фаза 3) — фейк с пустым
// множеством переиспользуется обоими ResolveEmployeeSalaryRulesService/
// ResolveShopEmployeeSalaryRulesService ниже (изоляция направлений, которую
// проверяет этот файл, признака служебного аккаунта не касается).
const fakeDirectoryRepo = {
    findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
} as unknown as DirectoryRepositoryPort;

// Расчётный период магазина заводится и закрывается независимо от периода
// сервиса (Фаза 11, issue #55/#56) — AccountingPeriod (Фаза 6) уже общая
// сущность для обоих направлений (уникальный ключ (direction, period), см.
// accounting-period.prisma). До Фазы 3 (issue #57 разделение close-хендлера)
// это было одним общим CloseAccountingPeriodHandler, читавшим direction из
// команды — тогда направление было runtime-веткой, которую легко было
// перепутать (см. исходную мотивацию этого теста в истории git). С Фазы 3
// CloseAccountingPeriodHandler обслуживает только direction='service' и не
// принимает direction в команде вовсе; с Фазы 13.5 у направления shop есть
// собственный симметричный вход — CloseShopAccountingPeriodHandler
// (domains/shop/modules/accounting/application/command/
// close-accounting-period.handler.ts), тоже без direction в команде.
// Направление теперь не runtime-ветка, а факт на уровне типов: какой класс
// вызван, то направление и закрывается. С Фазы 5 docs/service-shop-boundary-violations-fix
// оба хендлера полностью независимы и на уровне ТИПОВ: CloseAccountingPeriodHandler
// работает через ACCOUNTING_PERIOD_REPOSITORY/AccountingPeriod (сервис),
// CloseShopAccountingPeriodHandler — через собственные
// SHOP_ACCOUNTING_PERIOD_REPOSITORY/ShopAccountingPeriod (магазин). Тест
// здесь сохранён как регрессионная защита ключа (direction, period) уже не
// на уровне общего репозитория (его больше нет — см. WHY выше), а на уровне
// общей физической таблицы: оба независимых fake-репозитория ниже читают/
// пишут ОДИН и тот же сырой store (проекция общей Prisma-таблицы
// accounting_periods, partitioned по direction), каждый мапит строку в свой
// доменный тип — закрытие через CloseAccountingPeriodHandler не должно
// затрагивать строку с тем же period, но direction='shop', и наоборот —
// закрытие через CloseShopAccountingPeriodHandler не должно трогать строку
// direction='service'.
describe('CloseAccountingPeriodHandler / CloseShopAccountingPeriodHandler — не путают ключ (direction, period)', () => {
    type PeriodRecord = {
        id: string;
        status: 'OPEN' | 'CLOSED';
        closedBy: number | null;
        closedAt: Date | null;
    };
    const toRecord = (entity: {
        id: string;
        status: 'OPEN' | 'CLOSED';
        closedBy: number | null;
        closedAt: Date | null;
    }): PeriodRecord => ({
        id: entity.id,
        status: entity.status,
        closedBy: entity.closedBy,
        closedAt: entity.closedAt,
    });

    // Один и тот же key-value store имитирует реальный уникальный ключ
    // (direction, period) в Postgres — если бы один из хендлеров где-то
    // перепутал направление, эта проверка бы это поймала. serviceRepo/
    // shopRepo — два независимых fake-класса (как настоящие
    // AccountingPeriodRepository/ShopAccountingPeriodRepository), каждый
    // мапит сырую запись в свой собственный доменный тип.
    const createSharedPeriodStore = () => {
        const store = new Map<string, PeriodRecord>();
        const key = (direction: string, period: string) =>
            `${direction}:${period}`;

        const serviceRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod: (direction, period) => {
                const rec = store.get(key(direction, period));
                if (!rec) {
                    return Promise.resolve(null);
                }
                return Promise.resolve(
                    new AccountingPeriod({
                        id: rec.id,
                        props: {
                            direction,
                            period: Period.create(period),
                            status: rec.status,
                            closure:
                                rec.closedBy !== null && rec.closedAt !== null
                                    ? PeriodClosure.create(
                                          rec.closedBy,
                                          rec.closedAt,
                                      )
                                    : null,
                        },
                    }),
                );
            },
            save: (entity) => {
                store.set(
                    key(entity.direction, entity.period),
                    toRecord(entity),
                );
                return Promise.resolve();
            },
        };

        const shopRepo: ShopAccountingPeriodRepositoryPort = {
            findByPeriod: (period) => {
                const rec = store.get(key('shop', period));
                if (!rec) {
                    return Promise.resolve(null);
                }
                return Promise.resolve(
                    new ShopAccountingPeriod({
                        id: rec.id,
                        props: {
                            period: Period.create(period),
                            status: rec.status,
                            closure:
                                rec.closedBy !== null && rec.closedAt !== null
                                    ? ShopPeriodClosure.create(
                                          rec.closedBy,
                                          rec.closedAt,
                                      )
                                    : null,
                        },
                    }),
                );
            },
            save: (entity) => {
                store.set(key('shop', entity.period), toRecord(entity));
                return Promise.resolve();
            },
        };

        return { store, key, toRecord, serviceRepo, shopRepo };
    };

    // Зависимости PRD 1 (документы начисления) обоих хендлеров — с Фазы 6
    // docs/service-shop-boundary-violations-fix SalaryAccrual/ShopSalaryAccrual
    // раздельно реализованы по доменам (собственный независимый
    // Prisma-репозиторий и класс сущности на каждое направление, см.
    // salary-accrual.repository.ts), поэтому здесь уже не ОДИН общий
    // in-memory репозиторий на оба направления (как до Фазы 6 — общая
    // Prisma-таблица salary_accruals и тогда ещё общий класс/токен), а два
    // независимых стора — так же, как и настоящие независимые классы:
    // изоляция между направлениями теперь гарантирована на уровне ТИПОВ
    // (разные классы, разные токены), а не только рантайм-дисциплиной
    // фильтра по direction внутри одного класса.
    const createSharedAccrualDeps = () => {
        const serviceAccrualRepo = new InMemorySalaryAccrualRepository();
        const shopAccrualRepo = new InMemoryShopSalaryAccrualRepository();
        const employeeDismissal: EmployeeDismissalPort = {
            findDismissedEmployeeIds: () => Promise.resolve(new Set()),
        };
        const eventEmitter = {
            emitAsync: jest.fn().mockResolvedValue([]),
        } as unknown as EventEmitter2;
        return {
            serviceAccrualRepo,
            shopAccrualRepo,
            employeeDismissal,
            eventEmitter,
        };
    };
    type SharedAccrualDeps = ReturnType<typeof createSharedAccrualDeps>;

    const buildServiceSchema = (targetId: number) =>
        withRequestContext(() =>
            MotivationSchema.create({
                targetType: 'Employee',
                targetId,
                name: 'Оклад инженера',
                rules: [
                    PayPerHoursEntity.create({
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        config: { price: 250 },
                    }),
                ],
            }),
        );

    const buildShopSchema = (targetId: number) =>
        withRequestContext(() =>
            ShopMotivationSchema.create({
                targetType: 'Employee',
                targetId,
                name: 'Оклад продавца',
                rules: [
                    PayPerHourShopEntity.create({
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ONLINE_MANAGER',
                        config: { price: 250 },
                    }),
                ],
            }),
        );

    const buildServiceHandler = (
        periodRepo: AccountingPeriodRepositoryPort,
        accrualDeps: SharedAccrualDeps,
        schemas: MotivationSchema[] = [],
    ) => {
        const snapshotRepo: AccountingPeriodSnapshotPort = {
            saveAll: jest.fn().mockResolvedValue(undefined),
            findByKey: jest.fn(),
            findManyByKey: jest.fn().mockResolvedValue(new Map()),
            deleteByDirectionAndPeriod: jest.fn(),
        };
        const cacheRepo: AccountingCalculationCachePort = {
            find: jest.fn(),
            upsert: jest.fn(),
            deleteByDirectionAndPeriod: jest.fn().mockResolvedValue(undefined),
        };
        const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn(),
            findAllEmployeeTargets: jest.fn().mockResolvedValue(schemas),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn(),
            initializeName: jest.fn(),
        };
        const calculationDataSource = {
            findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
        } as unknown as ServiceCalculationDataPort;
        const salaryRulesResolver = new ResolveEmployeeSalaryRulesService(
            motivationSchemaRepo,
            calculationDataSource,
            fakeDirectoryRepo,
        );
        const salesPlanRepo: SalesPlanRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByDirectionAndPeriod: jest.fn().mockResolvedValue([]),
        };
        const unitOfWork: UnitOfWorkPort = { run: (work) => work() };
        const contextBuilder = {
            build: jest.fn((period: Period, employeeId: number) =>
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
                        hoursWorked: { fact: 8, prognose: 8 },
                    },
                    salesPerformanceDetail: null,
                }),
            ),
        } as unknown as BuildServiceCalculationContextService;

        return new CloseAccountingPeriodHandler(
            periodRepo,
            snapshotRepo,
            cacheRepo,
            salesPlanRepo,
            accrualDeps.serviceAccrualRepo,
            accrualDeps.employeeDismissal,
            unitOfWork,
            accrualDeps.eventEmitter,
            new CalculateServiceSnapshotRowsService(
                contextBuilder,
                salaryRulesResolver,
            ),
            new ErpPeriodSyncRunner({
                syncPeriod: jest.fn().mockResolvedValue(undefined),
            }),
        );
    };

    const buildShopHandler = (
        periodRepo: ShopAccountingPeriodRepositoryPort,
        accrualDeps: SharedAccrualDeps,
        schemas: ShopMotivationSchema[] = [],
    ) => {
        const snapshotRepo: ShopAccountingPeriodSnapshotPort = {
            saveAll: jest.fn().mockResolvedValue(undefined),
            findByKey: jest.fn(),
            findManyByKey: jest.fn().mockResolvedValue(new Map()),
            deleteByPeriod: jest.fn(),
        };
        const cacheRepo: ShopAccountingCalculationCachePort = {
            find: jest.fn(),
            upsert: jest.fn(),
            deleteByPeriod: jest.fn().mockResolvedValue(undefined),
        };
        const shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn(),
            findAllEmployeeTargets: jest.fn().mockResolvedValue(schemas),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn(),
            initializeName: jest.fn(),
        };
        const shopSalaryRulesResolver =
            new ResolveShopEmployeeSalaryRulesService(
                shopMotivationSchemaRepo,
                {
                    findEmployeeDepartmentId: jest.fn().mockResolvedValue(null),
                    findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
                } as unknown as ShopCalculationDataPort,
                fakeDirectoryRepo,
            );
        const salesPlanRepo: ShopSalesPlanRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByPeriod: jest.fn().mockResolvedValue([]),
        };
        const unitOfWork: UnitOfWorkPort = { run: (work) => work() };
        const shopContextBuilder = {
            build: jest.fn((period: Period, employeeId: number) =>
                Promise.resolve({
                    employee: { id: employeeId, identities: [] },
                    period: {
                        direction: 'shop' as const,
                        period: period.getValue(),
                        ...period.getBounds(),
                        status: 'OPEN' as const,
                    },
                    erpData: { hoursWorked: { fact: 8, prognose: 8 } },
                    salesPerformanceDetail: null,
                    salesPerformanceByCategory: new Map(),
                }),
            ),
        } as unknown as BuildShopCalculationContextService;

        return new CloseShopAccountingPeriodHandler(
            periodRepo,
            snapshotRepo,
            cacheRepo,
            salesPlanRepo,
            accrualDeps.shopAccrualRepo,
            accrualDeps.employeeDismissal,
            unitOfWork,
            accrualDeps.eventEmitter,
            new CalculateShopSnapshotRowsService(
                shopContextBuilder,
                shopSalaryRulesResolver,
            ),
            new ErpPeriodSyncRunner({
                syncPeriod: jest.fn().mockResolvedValue(undefined),
            }),
        );
    };

    it('закрытие периода направления service не переводит в CLOSED period с тем же значением, но direction=shop', async () => {
        const { store, key, toRecord, serviceRepo, shopRepo } =
            createSharedPeriodStore();
        const handler = buildServiceHandler(
            serviceRepo,
            createSharedAccrualDeps(),
        );

        // Заранее заводим "чужую" строку под тем же period, но direction=shop
        // — если бы хендлер/репозиторий где-то читали/писали без учёта
        // direction, эта запись оказалась бы задета.
        store.set(
            key('shop', '2026-07'),
            toRecord(ShopAccountingPeriod.openFor('2026-07')),
        );

        await withRequestContext(() =>
            handler.execute(
                new CloseAccountingPeriodCommand({
                    period: '2026-07',
                    closedBy: 1,
                }),
            ),
        );

        const servicePeriod = await serviceRepo.findByDirectionAndPeriod(
            'service',
            '2026-07',
        );
        expect(servicePeriod?.status).toBe('CLOSED');

        const shopPeriod = await shopRepo.findByPeriod('2026-07');
        expect(shopPeriod?.status).toBe('OPEN');
    });

    it('закрытие периода направления shop не переводит в CLOSED period с тем же значением, но direction=service', async () => {
        const { store, key, toRecord, serviceRepo, shopRepo } =
            createSharedPeriodStore();
        const handler = buildShopHandler(shopRepo, createSharedAccrualDeps());

        // Симметричная проверка: заранее заводим "чужую" строку под тем же
        // period, но direction=service.
        store.set(
            key('service', '2026-07'),
            toRecord(
                AccountingPeriod.openFor({
                    direction: 'service',
                    period: '2026-07',
                }),
            ),
        );

        await withRequestContext(() =>
            handler.execute(
                new CloseShopAccountingPeriodCommand({
                    period: '2026-07',
                    closedBy: 1,
                }),
            ),
        );

        const shopPeriod = await shopRepo.findByPeriod('2026-07');
        expect(shopPeriod?.status).toBe('CLOSED');

        const servicePeriod = await serviceRepo.findByDirectionAndPeriod(
            'service',
            '2026-07',
        );
        expect(servicePeriod?.status).toBe('OPEN');
    });

    // PRD 1 docs/payroll-closing-and-accrual: "Закрытие service не создаёт
    // документов shop и не меняет статус периода shop" — и наоборот.
    it('закрытие service создаёт документы начисления только direction=service и не трогает документы shop', async () => {
        const { serviceRepo, shopRepo } = createSharedPeriodStore();
        const accrualDeps = createSharedAccrualDeps();
        const serviceHandler = buildServiceHandler(serviceRepo, accrualDeps, [
            buildServiceSchema(42),
        ]);
        const shopHandler = buildShopHandler(shopRepo, accrualDeps, [
            buildShopSchema(42),
        ]);

        // Сначала закрыт shop — у сотрудника 42 есть документ shop.
        await withRequestContext(() =>
            shopHandler.execute(
                new CloseShopAccountingPeriodCommand({
                    period: '2026-07',
                    closedBy: 1,
                }),
            ),
        );
        const shopBefore =
            await accrualDeps.shopAccrualRepo.findByPeriod('2026-07');
        expect(shopBefore).toHaveLength(1);

        await withRequestContext(() =>
            serviceHandler.execute(
                new CloseAccountingPeriodCommand({
                    period: '2026-07',
                    closedBy: 1,
                }),
            ),
        );

        const serviceAccruals =
            await accrualDeps.serviceAccrualRepo.findByDirectionAndPeriod(
                'service',
                '2026-07',
            );
        const shopAccruals =
            await accrualDeps.shopAccrualRepo.findByPeriod('2026-07');
        expect(serviceAccruals.map((a) => a.direction)).toEqual(['service']);
        // Документ shop остался тем же самым (не пересоздан и не удалён) —
        // хендлер service физически не может его задеть: он пишет в
        // отдельный независимый стор (serviceAccrualRepo), не тот, что читал
        // shopHandler (shopAccrualRepo).
        expect(shopAccruals.map((a) => a.id)).toEqual(
            shopBefore.map((a) => a.id),
        );
        expect(accrualDeps.serviceAccrualRepo.store.size).toBe(1);
        expect(accrualDeps.shopAccrualRepo.store.size).toBe(1);
    });
});
