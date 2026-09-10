import { BuildShopCalculationContextService } from './build-calculation-context.service';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import type { ShopSalesPerformanceReaderPort } from '@/domains/shop/modules/sales/application/ports/sales-performance.port';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/sales-performance.value-object';
import { Period } from '@/shared/domain/period.value-object';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import type { Task } from '@/modules/tasks/domain/entities/task.entity';
import { TaskCompletionShop } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { DepartmentPercentEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/department-percent.entity';
import { DepartmentPlanBonusEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/department-plan-bonus.entity';
import { DepartmentTurnoverBonusEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/department-turnover-bonus.entity';
import { turnoverPerformanceScopeKey } from '@/domains/shop/modules/accounting/domain/types/calculation-context.types';
import type { ShopTurnoverPerformanceReaderPort } from '@/domains/shop/modules/accounting/application/ports/turnover-performance/turnover-performance.port';

// Юнит для BuildShopCalculationContextService (Фаза 13.5, issue #57) —
// зеркало по духу спека сборки контекста сервиса (нет отдельного файла у
// build-service-calculation-context.service.ts, но тот же стиль
// in-memory-фейков портов, что и у close-accounting-period.handler.spec.ts).
// Особое внимание — третьему параметру build(), rules: он есть только у
// shop-версии (categoryDescendantFolderIds зависит от category правил
// РАСЧЁТЫВАЕМОЙ схемы, см. комментарий у build-calculation-context.service.ts).
describe('BuildShopCalculationContextService', () => {
    const buildRule = (
        type: ShopSalaryRule['type'],
        category?: string | null,
    ): ShopSalaryRule =>
        ({
            id: `rule-${type}-${category ?? 'null'}`,
            name: type,
            type,
            targetRole: 'ONLINE_MANAGER',
            config: category === undefined ? {} : { category },
            updatedAt: new Date(),
            calculate: jest.fn(),
        }) as unknown as ShopSalaryRule;

    const buildService = (overrides?: {
        departmentId?: number | null;
        performance?: ShopSalesPerformance | null;
        // Позволяет резолвить разные ShopSalesPerformance по разным
        // category (findForScope третьим аргументом) — иначе один и тот же
        // mockResolvedValue(performance) вернулся бы для ЛЮБОЙ category, и
        // тест не отличил бы "резолвим один раз на сотрудника" от "резолвим
        // по каждой уникальной category".
        performanceByCategory?: Record<string, ShopSalesPerformance | null>;
        // findManyByIds фейка TASK_REPOSITORY (src/modules/tasks),
        // переопределяемый тестами erpData.taskCompletionStatuses ниже.
        findManyByIds?: jest.Mock;
        // Implements FR4 of add-department-head-salary-rules (tasks.md раздел 13) —
        // мок SHOP_TURNOVER_PERFORMANCE_READER, переопределяемый тестами turnoverPerformance ниже.
        turnoverFindForScope?: jest.Mock;
    }) => {
        const findEmployeeIdentities = jest.fn().mockResolvedValue([]);
        const findHoursWorked = jest
            .fn()
            .mockResolvedValue({ fact: 8, prognose: 8 });
        const findProductSoldItems = jest.fn().mockResolvedValue([]);
        const findEmployeeDepartmentId = jest
            .fn()
            .mockResolvedValue(overrides?.departmentId ?? null);
        const resolveCategoryDescendantFolderIds = jest
            .fn()
            .mockResolvedValue({ 'root-1': ['root-1', 'child-1'] });

        const dataSource: ShopCalculationDataPort = {
            findEmployeeIdentities,
            findHoursWorked,
            findProductSoldItems,
            findEmployeeDepartmentId,
            findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
            findEmployeeIdentitiesForEmployees: jest
                .fn()
                .mockResolvedValue(new Map()),
            findHoursWorkedForEmployees: jest.fn().mockResolvedValue(new Map()),
            resolveCategoryDescendantFolderIds,
        };

        const findForScope = jest
            .fn()
            .mockImplementation(
                (
                    _period: string,
                    _department: number,
                    category: string | null,
                ) => {
                    if (overrides?.performanceByCategory && category !== null) {
                        return Promise.resolve(
                            overrides.performanceByCategory[category] ?? null,
                        );
                    }
                    return Promise.resolve(overrides?.performance ?? null);
                },
            );
        const salesPerformanceReader: ShopSalesPerformanceReaderPort = {
            listForPeriod: jest.fn().mockResolvedValue([]),
            findForScope,
            listForDepartment: jest.fn().mockResolvedValue([]),
        };

        const findManyByIds =
            overrides?.findManyByIds ?? jest.fn().mockResolvedValue([]);
        const taskRepo = {
            insert: jest.fn(),
            update: jest.fn(),
            findById: jest.fn(),
            findManyByIds,
            findMany: jest.fn(),
        } as unknown as TaskRepositoryPort;

        const turnoverFindForScope =
            overrides?.turnoverFindForScope ??
            jest.fn().mockResolvedValue(null);
        const turnoverPerformanceReader: ShopTurnoverPerformanceReaderPort = {
            findForScope: turnoverFindForScope,
        };

        const service = new BuildShopCalculationContextService(
            dataSource,
            salesPerformanceReader,
            taskRepo,
            turnoverPerformanceReader,
        );

        return {
            service,
            dataSource,
            salesPerformanceReader,
            taskRepo,
            findManyByIds,
            findEmployeeIdentities,
            findHoursWorked,
            findProductSoldItems,
            findEmployeeDepartmentId,
            resolveCategoryDescendantFolderIds,
            findForScope,
            turnoverFindForScope,
        };
    };

    it('раскрывает category только у правил ProductSold/UsedProductSold, дедуплицируя id', async () => {
        const { service, resolveCategoryDescendantFolderIds } = buildService();
        const rules = [
            buildRule('PayPerHour'),
            buildRule('ProductSold', 'root-1'),
            buildRule('UsedProductSold', 'root-1'),
            buildRule('ProductSold', null),
        ];

        const context = await service.build(Period.create('2026-01'), 1, rules);

        expect(resolveCategoryDescendantFolderIds).toHaveBeenCalledTimes(1);
        expect(resolveCategoryDescendantFolderIds).toHaveBeenCalledWith([
            'root-1',
        ]);
        expect(context.erpData.categoryDescendantFolderIds).toEqual({
            'root-1': ['root-1', 'child-1'],
        });
    });

    it('нет правил с category — resolveCategoryDescendantFolderIds не вызывается', async () => {
        const { service, resolveCategoryDescendantFolderIds } = buildService();
        const rules = [buildRule('PayPerHour')];

        const context = await service.build(Period.create('2026-01'), 1, rules);

        expect(resolveCategoryDescendantFolderIds).not.toHaveBeenCalled();
        expect(context.erpData.categoryDescendantFolderIds).toEqual({});
    });

    it('нет отдела у сотрудника — salesPerformanceDetail null, в модуль sales не ходим', async () => {
        const { service, findForScope } = buildService({
            departmentId: null,
        });

        const context = await service.build(Period.create('2026-01'), 1, []);

        expect(context.salesPerformanceDetail).toBeNull();
        expect(findForScope).not.toHaveBeenCalled();
    });

    it('есть отдел — ищет ShopSalesPerformance по отделу без категории', async () => {
        const performance = { fake: true } as unknown as ShopSalesPerformance;
        const { service, findForScope } = buildService({
            departmentId: 42,
            performance,
        });

        const context = await service.build(Period.create('2026-01'), 1, []);

        expect(findForScope).toHaveBeenCalledWith('2026-01', 42, null);
        expect(context.salesPerformanceDetail).toBe(performance);
    });

    describe('salesPerformanceByCategory (Фаза 2 плана shop-sales-performance-by-category)', () => {
        it('резолвит salesPerformance отдельным вызовом findForScope на каждую уникальную category правил схемы, а не один раз на сотрудника', async () => {
            const departmentPerformance = {
                department: true,
            } as unknown as ShopSalesPerformance;
            const categoryAPerformance = {
                category: 'a',
            } as unknown as ShopSalesPerformance;
            const categoryBPerformance = {
                category: 'b',
            } as unknown as ShopSalesPerformance;
            const { service, findForScope } = buildService({
                departmentId: 7,
                performance: departmentPerformance,
                performanceByCategory: {
                    'cat-a': categoryAPerformance,
                    'cat-b': categoryBPerformance,
                },
            });
            const rules = [
                buildRule('ProductSold', 'cat-a'),
                buildRule('UsedProductSold', 'cat-b'),
                // Дубликат категории 'cat-a' у другого правила — не должен
                // породить второй вызов findForScope на эту же category.
                buildRule('ProductSold', 'cat-a'),
            ];

            const context = await service.build(
                Period.create('2026-01'),
                1,
                rules,
            );

            // Один вызов на "весь отдел" (category: null, переиспользован из
            // salesPerformanceDetail) + один на каждую уникальную category
            // ('cat-a', 'cat-b') — не 2 * количество ProductSold/UsedProductSold
            // правил и не единственный вызов на сотрудника целиком.
            expect(findForScope).toHaveBeenCalledTimes(3);
            expect(findForScope).toHaveBeenCalledWith('2026-01', 7, null);
            expect(findForScope).toHaveBeenCalledWith('2026-01', 7, 'cat-a');
            expect(findForScope).toHaveBeenCalledWith('2026-01', 7, 'cat-b');

            expect(context.salesPerformanceByCategory).toEqual(
                new Map([
                    [null, departmentPerformance],
                    ['cat-a', categoryAPerformance],
                    ['cat-b', categoryBPerformance],
                ]),
            );
        });

        it('category правила без найденной строки плана/факта — отсутствует в карте (fail closed резолвится дальше, в самом правиле)', async () => {
            const departmentPerformance = {
                department: true,
            } as unknown as ShopSalesPerformance;
            const { service } = buildService({
                departmentId: 7,
                performance: departmentPerformance,
                performanceByCategory: {
                    'cat-with-plan': {
                        found: true,
                    } as unknown as ShopSalesPerformance,
                    // 'cat-without-plan' намеренно отсутствует в объекте —
                    // findForScope резолвится в null для неё.
                },
            });
            const rules = [
                buildRule('ProductSold', 'cat-with-plan'),
                buildRule('ProductSold', 'cat-without-plan'),
            ];

            const context = await service.build(
                Period.create('2026-01'),
                1,
                rules,
            );

            expect(
                context.salesPerformanceByCategory.has('cat-without-plan'),
            ).toBe(false);
            expect(
                context.salesPerformanceByCategory.get('cat-with-plan'),
            ).toEqual({
                found: true,
            });
        });

        it('нет правил с category — карта несёт только запись "весь отдел" (null), findForScope вызывается один раз', async () => {
            const departmentPerformance = {
                department: true,
            } as unknown as ShopSalesPerformance;
            const { service, findForScope } = buildService({
                departmentId: 7,
                performance: departmentPerformance,
            });
            const rules = [buildRule('PayPerHour')];

            const context = await service.build(
                Period.create('2026-01'),
                1,
                rules,
            );

            expect(findForScope).toHaveBeenCalledTimes(1);
            expect(context.salesPerformanceByCategory).toEqual(
                new Map([[null, departmentPerformance]]),
            );
        });
    });

    it('собирает identities/hoursWorked/productSoldItems из БД', async () => {
        const { service, dataSource } = buildService();
        (dataSource.findEmployeeIdentities as jest.Mock).mockResolvedValue([
            {
                system: 'MOY_SKLAD',
                identifierType: 'EMPLOYEE_ID',
                externalId: '7',
            },
        ]);
        (dataSource.findHoursWorked as jest.Mock).mockResolvedValue({
            fact: 120,
            prognose: 120,
        });

        const context = await service.build(Period.create('2026-01'), 7, []);

        expect(context.employee).toEqual({
            id: 7,
            identities: [
                {
                    system: 'MOY_SKLAD',
                    identifierType: 'EMPLOYEE_ID',
                    externalId: '7',
                },
            ],
        });
        expect(context.erpData.hoursWorked).toEqual({
            fact: 120,
            prognose: 120,
        });
        expect(context.period.direction).toBe('shop');
        expect(context.period.period).toBe('2026-01');
    });

    describe('findSalesPerformanceForEmployee', () => {
        it('нет отдела — null, без похода в модуль sales', async () => {
            const { service, findForScope } = buildService({
                departmentId: null,
            });

            const result = await service.findSalesPerformanceForEmployee(
                Period.create('2026-01'),
                1,
            );

            expect(result).toBeNull();
            expect(findForScope).not.toHaveBeenCalled();
        });

        it('есть отдел — тот же findForScope, что и build()', async () => {
            const performance = {
                fake: true,
            } as unknown as ShopSalesPerformance;
            const { service, findForScope } = buildService({
                departmentId: 5,
                performance,
            });

            const result = await service.findSalesPerformanceForEmployee(
                Period.create('2026-01'),
                1,
            );

            expect(findForScope).toHaveBeenCalledWith('2026-01', 5, null);
            expect(result).toBe(performance);
        });
    });

    // openspec/changes/replace-bitrix-task-integration, design.md решение 5 —
    // BuildShopCalculationContextService заполняет erpData.taskCompletionStatuses
    // статусами ShopSalaryTask, построенными по TASK_REPOSITORY.findManyByIds
    // (src/modules/tasks), для всех TaskCompletion-правил переданной схемы,
    // у которых есть taskId за ТЕКУЩИЙ период (config.taskIdByPeriod).
    // Остальные поля erpData здесь не переиспытываются — покрыты тестами
    // выше.
    describe('taskCompletionStatuses', () => {
        const buildTaskCompletionRule = (taskId = 'task-1') =>
            TaskCompletionShop.create({
                type: 'TaskCompletion',
                name: 'Собрать отчёт по браку',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    taskId,
                    taskTitleTemplate: 'Собрать отчёт по браку за месяц',
                    isRecurring: true,
                    deadlineTemplate: '2026-08-05',
                    defaultAmount: 5000,
                },
            });

        it('заполняет taskCompletionStatuses найденной задачей текущего периода', async () => {
            const rule = buildTaskCompletionRule('task-1');
            const taskId = Object.values(rule.config.taskIdByPeriod)[0];
            const task = {
                id: taskId,
                status: { code: 'CLOSED_SUCCESSFULLY' },
            } as unknown as Task;
            const findManyByIds = jest.fn().mockResolvedValue([task]);
            const { service } = buildService({ findManyByIds });
            const currentPeriod = Object.keys(rule.config.taskIdByPeriod)[0];

            const context = await service.build(
                Period.create(currentPeriod),
                1,
                [rule],
            );

            expect(findManyByIds).toHaveBeenCalledWith([taskId]);
            const entry = context.erpData.taskCompletionStatuses?.[rule.id];
            expect(entry?.taskId).toBe(taskId);
            expect(entry?.status).toBe('CLOSED_SUCCESSFULLY');
            expect(entry?.isCompleted()).toBe(true);
        });

        it('TaskCompletion-правило без найденной задачи не попадает в taskCompletionStatuses', async () => {
            const rule = buildTaskCompletionRule('task-1');
            const findManyByIds = jest.fn().mockResolvedValue([]);
            const { service } = buildService({ findManyByIds });
            const currentPeriod = Object.keys(rule.config.taskIdByPeriod)[0];

            const context = await service.build(
                Period.create(currentPeriod),
                1,
                [rule],
            );

            expect(context.erpData.taskCompletionStatuses).toEqual({});
        });

        it('нет TaskCompletion-правил в переданном наборе — не делает запрос за статусами', async () => {
            const payPerHour = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'ONLINE_MANAGER',
                config: { price: 100 },
            });
            const findManyByIds = jest.fn().mockResolvedValue([]);
            const { service } = buildService({ findManyByIds });

            const context = await service.build(Period.create('2026-08'), 1, [
                payPerHour,
            ]);

            expect(findManyByIds).not.toHaveBeenCalled();
            expect(context.erpData.taskCompletionStatuses).toEqual({});
        });
    });

    // Implements FR2-FR4 of add-department-head-salary-rules (tasks.md раздел 13, зеркало service —
    // build-service-calculation-context.service.spec.ts).
    describe('departmentSalesPerformance / turnoverPerformance', () => {
        const buildFakeShopSalesPerformance = (
            turnover: number,
            margin: number,
            percentCompletion: number,
        ): ShopSalesPerformance =>
            ({
                getFact: () => ({
                    getTurnover: () => turnover,
                    getMargin: () => margin,
                    getPercentCompletion: () => percentCompletion,
                }),
            }) as unknown as ShopSalesPerformance;

        const percentBorders = [
            {
                name: 'A',
                fromPlanPercent: 50,
                multiplier: 0.5,
                mode: 'FIX' as const,
            },
            {
                name: 'B',
                fromPlanPercent: 70,
                multiplier: 1,
                mode: 'FIX' as const,
            },
            {
                name: 'C',
                fromPlanPercent: 100,
                multiplier: 1.5,
                mode: 'FIX' as const,
            },
        ] as const;

        const buildDepartmentPercentRule = (category: string | null) =>
            DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Процент от факта',
                targetRole: 'DEPARTMENT_HEAD',
                config: { salaryBasis: 'REVENUE', category, percent: 5 },
            });

        const buildDepartmentPlanBonusRule = (category: string | null) =>
            DepartmentPlanBonusEntity.create({
                type: 'DepartmentPlanBonus',
                name: 'Бонус за план',
                targetRole: 'DEPARTMENT_HEAD',
                config: {
                    salaryBasis: 'REVENUE',
                    category,
                    fixedAmount: 10000,
                    percentBorders: [...percentBorders],
                },
            });

        const buildDepartmentTurnoverBonusRule = (
            warehouseId: string,
            category: string | null,
        ) =>
            DepartmentTurnoverBonusEntity.create({
                type: 'DepartmentTurnoverBonus',
                name: 'Бонус за оборачиваемость',
                targetRole: 'DEPARTMENT_HEAD',
                config: {
                    warehouseId,
                    category,
                    fixedAmount: 5000,
                    planTurnoverRatio: 1,
                    percentBorders: [...percentBorders],
                },
            });

        describe('departmentSalesPerformance', () => {
            it('null, если у сотрудника нет отдела', async () => {
                const { service } = buildService({ departmentId: null });

                const context = await service.build(
                    Period.create('2026-08'),
                    1,
                    [buildDepartmentPercentRule(null)],
                );

                expect(context.departmentSalesPerformance).toBeNull();
            });

            it('резолвит fact/percentCompletion по собственной category правила', async () => {
                const performance = buildFakeShopSalesPerformance(
                    100000,
                    40000,
                    80,
                );
                const { service, findForScope } = buildService({
                    departmentId: 10,
                    performanceByCategory: { 'cat-1': performance },
                });

                const context = await service.build(
                    Period.create('2026-08'),
                    1,
                    [buildDepartmentPercentRule('cat-1')],
                );

                expect(findForScope).toHaveBeenCalledWith(
                    '2026-08',
                    10,
                    'cat-1',
                );
                expect(
                    context.departmentSalesPerformance?.get('cat-1'),
                ).toEqual({
                    fact: { turnover: 100000, margin: 40000 },
                    percentCompletion: 80,
                });
            });

            it('категория без ShopSalesPerformance отсутствует в карте', async () => {
                const { service } = buildService({
                    departmentId: 10,
                    performanceByCategory: {},
                });

                const context = await service.build(
                    Period.create('2026-08'),
                    1,
                    [buildDepartmentPercentRule('cat-1')],
                );

                expect(context.departmentSalesPerformance?.has('cat-1')).toBe(
                    false,
                );
            });

            it('дедуплицирует одинаковую category у нескольких правил — один запрос на неё', async () => {
                const performance = buildFakeShopSalesPerformance(1, 1, 1);
                const { service, findForScope } = buildService({
                    departmentId: 10,
                    performanceByCategory: { 'cat-1': performance },
                });

                await service.build(Period.create('2026-08'), 1, [
                    buildDepartmentPercentRule('cat-1'),
                    buildDepartmentPlanBonusRule('cat-1'),
                ]);

                const callsForCategory = findForScope.mock.calls.filter(
                    ([, , category]: [string, number, string | null]) =>
                        category === 'cat-1',
                );
                expect(callsForCategory).toHaveLength(1);
            });

            it('пустая карта, если в схеме нет правил уровня отдела по продажам', async () => {
                const { service } = buildService({ departmentId: 10 });
                const payPerHour = PayPerHourShopEntity.create({
                    type: 'PayPerHour',
                    name: 'Часы',
                    targetRole: 'ONLINE_MANAGER',
                    config: { price: 100 },
                });

                const context = await service.build(
                    Period.create('2026-08'),
                    1,
                    [payPerHour],
                );

                expect(context.departmentSalesPerformance).toEqual(new Map());
            });
        });

        describe('turnoverPerformance', () => {
            it('резолвит факт по warehouseId+category правила DepartmentTurnoverBonus', async () => {
                const turnoverFindForScope = jest.fn().mockResolvedValue(1.5);
                const { service } = buildService({ turnoverFindForScope });
                const rule = buildDepartmentTurnoverBonusRule('wh-1', 'cat-2');

                const context = await service.build(
                    Period.create('2026-08'),
                    1,
                    [rule],
                );

                expect(turnoverFindForScope).toHaveBeenCalledWith(
                    '2026-08',
                    'wh-1',
                    'cat-2',
                );
                expect(
                    context.turnoverPerformance.get(
                        turnoverPerformanceScopeKey({
                            warehouseId: 'wh-1',
                            category: 'cat-2',
                        }),
                    ),
                ).toBe(1.5);
            });

            it('дедуплицирует одинаковый scope у нескольких правил — один запрос', async () => {
                const turnoverFindForScope = jest.fn().mockResolvedValue(2);
                const { service } = buildService({ turnoverFindForScope });

                await service.build(Period.create('2026-08'), 1, [
                    buildDepartmentTurnoverBonusRule('wh-1', 'cat-2'),
                    buildDepartmentTurnoverBonusRule('wh-1', 'cat-2'),
                ]);

                expect(turnoverFindForScope).toHaveBeenCalledTimes(1);
            });

            it('хранит null явно, если для scope недостаточно данных', async () => {
                const turnoverFindForScope = jest.fn().mockResolvedValue(null);
                const { service } = buildService({ turnoverFindForScope });
                const key = turnoverPerformanceScopeKey({
                    warehouseId: 'wh-1',
                    category: null,
                });

                const context = await service.build(
                    Period.create('2026-08'),
                    1,
                    [buildDepartmentTurnoverBonusRule('wh-1', null)],
                );

                expect(context.turnoverPerformance.has(key)).toBe(true);
                expect(context.turnoverPerformance.get(key)).toBeNull();
            });

            it('пустая карта и без запросов, если в схеме нет DepartmentTurnoverBonus', async () => {
                const turnoverFindForScope = jest.fn();
                const { service } = buildService({ turnoverFindForScope });
                const payPerHour = PayPerHourShopEntity.create({
                    type: 'PayPerHour',
                    name: 'Часы',
                    targetRole: 'ONLINE_MANAGER',
                    config: { price: 100 },
                });

                const context = await service.build(
                    Period.create('2026-08'),
                    1,
                    [payPerHour],
                );

                expect(context.turnoverPerformance).toEqual(new Map());
                expect(turnoverFindForScope).not.toHaveBeenCalled();
            });
        });
    });
});
