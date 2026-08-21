import { CloseAccountingPeriodHandler } from './close-accounting-period.handler';
import { CloseAccountingPeriodCommand } from './close-accounting-period.command';
import { CloseShopAccountingPeriodHandler } from '@/domains/shop/modules/accounting/application/command/close-shop-accounting-period.handler';
import { CloseShopAccountingPeriodCommand } from '@/domains/shop/modules/accounting/application/command/close-shop-accounting-period.command';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/resolve-shop-employee-salary-rules.service';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import type { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/build-service-calculation-context.service';
import type { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/build-shop-calculation-context.service';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import { Period } from '@/shared/domain/period.value-object';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { EmployeeDismissalPort } from '@/domains/service/modules/accounting/application/ports/employee-dismissal.port';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/testing/in-memory-salary-accrual.repository';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';

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
// close-shop-accounting-period.handler.ts), тоже без direction в команде.
// Направление теперь не runtime-ветка, а факт на уровне типов: какой класс
// вызван, то направление и закрывается. Тест здесь сохранён как
// регрессионная защита ключа (direction, period) уже на уровне двух
// независимых хендлеров, работающих с общим репозиторием периода: закрытие
// через CloseAccountingPeriodHandler не должно затрагивать строку с тем же
// period, но direction='shop', и наоборот — закрытие через
// CloseShopAccountingPeriodHandler не должно трогать строку direction='service'.
describe('CloseAccountingPeriodHandler / CloseShopAccountingPeriodHandler — не путают ключ (direction, period)', () => {
    // Один и тот же key-value store имитирует реальный уникальный ключ
    // (direction, period) в Postgres — если бы один из хендлеров/общий
    // репозиторий где-то перепутал направление, эта проверка бы это поймала.
    const createSharedPeriodRepo = () => {
        const store = new Map<string, AccountingPeriod>();
        const key = (direction: string, period: string) =>
            `${direction}:${period}`;

        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod: (direction, period) =>
                Promise.resolve(store.get(key(direction, period)) ?? null),
            save: (entity) => {
                store.set(key(entity.direction, entity.period), entity);
                return Promise.resolve();
            },
        };

        return { store, key, periodRepo };
    };

    // Общие для обоих хендлеров зависимости PRD 1 (документы начисления):
    // один in-memory репозиторий документов на оба направления — та же
    // логика проверки ключа (direction, period), что и у periodRepo выше.
    const createSharedAccrualDeps = () => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const employeeDismissal: EmployeeDismissalPort = {
            findDismissedEmployeeIds: () => Promise.resolve(new Set()),
        };
        const eventEmitter = {
            emitAsync: jest.fn().mockResolvedValue([]),
        } as unknown as EventEmitter2;
        return { accrualRepo, employeeDismissal, eventEmitter };
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
                    erpData: { serviceCompletedItems: [], hoursWorked: 8 },
                    salesPerformanceDetail: null,
                }),
            ),
        } as unknown as BuildServiceCalculationContextService;

        return new CloseAccountingPeriodHandler(
            periodRepo,
            snapshotRepo,
            cacheRepo,
            salesPlanRepo,
            accrualDeps.accrualRepo,
            accrualDeps.employeeDismissal,
            unitOfWork,
            accrualDeps.eventEmitter,
            contextBuilder,
            salaryRulesResolver,
        );
    };

    const buildShopHandler = (
        periodRepo: AccountingPeriodRepositoryPort,
        accrualDeps: SharedAccrualDeps,
        schemas: ShopMotivationSchema[] = [],
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
                    erpData: { hoursWorked: 8 },
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
            accrualDeps.accrualRepo,
            accrualDeps.employeeDismissal,
            unitOfWork,
            accrualDeps.eventEmitter,
            shopContextBuilder,
            shopSalaryRulesResolver,
        );
    };

    it('закрытие периода направления service не переводит в CLOSED period с тем же значением, но direction=shop', async () => {
        const { store, key, periodRepo } = createSharedPeriodRepo();
        const handler = buildServiceHandler(
            periodRepo,
            createSharedAccrualDeps(),
        );

        // Заранее заводим "чужую" строку под тем же period, но direction=shop
        // — если бы хендлер/репозиторий где-то читали/писали без учёта
        // direction, эта запись оказалась бы задета.
        store.set(
            key('shop', '2026-08'),
            AccountingPeriod.openFor({ direction: 'shop', period: '2026-08' }),
        );

        await withRequestContext(() =>
            handler.execute(
                new CloseAccountingPeriodCommand({
                    period: '2026-08',
                    closedBy: 1,
                }),
            ),
        );

        const servicePeriod = await periodRepo.findByDirectionAndPeriod(
            'service',
            '2026-08',
        );
        expect(servicePeriod?.status).toBe('CLOSED');

        const shopPeriod = await periodRepo.findByDirectionAndPeriod(
            'shop',
            '2026-08',
        );
        expect(shopPeriod?.status).toBe('OPEN');
    });

    it('закрытие периода направления shop не переводит в CLOSED period с тем же значением, но direction=service', async () => {
        const { store, key, periodRepo } = createSharedPeriodRepo();
        const handler = buildShopHandler(periodRepo, createSharedAccrualDeps());

        // Симметричная проверка: заранее заводим "чужую" строку под тем же
        // period, но direction=service.
        store.set(
            key('service', '2026-08'),
            AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-08',
            }),
        );

        await withRequestContext(() =>
            handler.execute(
                new CloseShopAccountingPeriodCommand({
                    period: '2026-08',
                    closedBy: 1,
                }),
            ),
        );

        const shopPeriod = await periodRepo.findByDirectionAndPeriod(
            'shop',
            '2026-08',
        );
        expect(shopPeriod?.status).toBe('CLOSED');

        const servicePeriod = await periodRepo.findByDirectionAndPeriod(
            'service',
            '2026-08',
        );
        expect(servicePeriod?.status).toBe('OPEN');
    });

    // PRD 1 docs/payroll-closing-and-accrual: "Закрытие service не создаёт
    // документов shop и не меняет статус периода shop" — и наоборот.
    it('закрытие service создаёт документы начисления только direction=service и не трогает документы shop', async () => {
        const { periodRepo } = createSharedPeriodRepo();
        const accrualDeps = createSharedAccrualDeps();
        const serviceHandler = buildServiceHandler(periodRepo, accrualDeps, [
            buildServiceSchema(42),
        ]);
        const shopHandler = buildShopHandler(periodRepo, accrualDeps, [
            buildShopSchema(42),
        ]);

        // Сначала закрыт shop — у сотрудника 42 есть документ shop.
        await withRequestContext(() =>
            shopHandler.execute(
                new CloseShopAccountingPeriodCommand({
                    period: '2026-08',
                    closedBy: 1,
                }),
            ),
        );
        const shopBefore =
            await accrualDeps.accrualRepo.findByDirectionAndPeriod(
                'shop',
                '2026-08',
            );
        expect(shopBefore).toHaveLength(1);

        await withRequestContext(() =>
            serviceHandler.execute(
                new CloseAccountingPeriodCommand({
                    period: '2026-08',
                    closedBy: 1,
                }),
            ),
        );

        const serviceAccruals =
            await accrualDeps.accrualRepo.findByDirectionAndPeriod(
                'service',
                '2026-08',
            );
        const shopAccruals =
            await accrualDeps.accrualRepo.findByDirectionAndPeriod(
                'shop',
                '2026-08',
            );
        expect(serviceAccruals.map((a) => a.direction)).toEqual(['service']);
        // Документ shop остался тем же самым (не пересоздан и не удалён).
        expect(shopAccruals.map((a) => a.id)).toEqual(
            shopBefore.map((a) => a.id),
        );
        expect(accrualDeps.accrualRepo.store.size).toBe(2);
    });
});
