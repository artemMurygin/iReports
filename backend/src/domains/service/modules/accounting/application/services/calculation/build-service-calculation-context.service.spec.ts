import { BuildServiceCalculationContextService } from './build-service-calculation-context.service';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/calculation/service-calculation-data.port';
import type { SalesPerformanceReaderPort } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import { TaskStatus } from '@/modules/tasks/domain/value-objects/task-status.value-object';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { DepartmentPercentEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/department-percent.entity';
import { DepartmentPlanBonusEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/department-plan-bonus.entity';
import { DepartmentTurnoverBonusEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/department-turnover-bonus.entity';
import { turnoverPerformanceScopeKey } from '@/domains/service/modules/accounting/domain/types/calculation-context.types';
import type { TurnoverPerformanceReaderPort } from '@/domains/service/modules/accounting/application/ports/turnover-performance/turnover-performance.port';
import { Period } from '@/shared/domain/period.value-object';

// replace-bitrix-task-integration, design.md решение 5 —
// BuildServiceCalculationContextService заполняет erpData.taskCompletionStatuses
// SalaryTask (accounting) ТЕКУЩЕГО периода для всех TaskCompletion-правил
// переданной схемы, читая taskId из config.taskIdByPeriod[period] и вызывая
// TASK_REPOSITORY.findManyByIds() напрямую (без Port/Adapter). Остальные
// поля erpData (Фаза 7/8) здесь не переиспытываются заново — покрыты
// существующими вызывающими (GetEmployeeSalaryReportService и т.п.), этот
// файл сфокусирован на новом поведении.
describe('BuildServiceCalculationContextService — taskCompletionStatuses', () => {
    // TaskCompletion.create() всегда пишет taskId в taskIdByPeriod ТЕКУЩЕГО
    // периода (Period.current()) — тесты этого файла конструируют правило
    // напрямую, с произвольным периодом '2026-08', не привязанным к
    // системной дате.
    const buildTaskCompletionRule = (taskIdByPeriod: Record<string, string>) =>
        new TaskCompletion({
            id: 'rule-1',
            props: {
                name: 'Собрать отчёт по браку',
                type: 'TaskCompletion',
                targetRole: 'ENGINEER',
                config: {
                    taskIdByPeriod,
                    taskTitleTemplate: 'Собрать отчёт по браку за месяц',
                    isRecurring: true,
                    deadlineTemplate: '2026-08-05',
                    defaultAmount: 5000,
                },
            },
        });

    const buildDataSource = (): ServiceCalculationDataPort => ({
        findEmployeeIdentities: jest.fn().mockResolvedValue([]),
        findServiceCompletedItems: jest.fn().mockResolvedValue([]),
        findHoursWorked: jest.fn().mockResolvedValue({ fact: 0, prognose: 0 }),
        findOrderPayedItems: jest.fn().mockResolvedValue([]),
        findEmployeeDepartmentId: jest.fn().mockResolvedValue(null),
        findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
        findEmployeeIdentitiesForEmployees: jest
            .fn()
            .mockResolvedValue(new Map()),
        findHoursWorkedForEmployees: jest.fn().mockResolvedValue(new Map()),
    });

    const buildSalesPerformanceReader = (): SalesPerformanceReaderPort => ({
        listForPeriod: jest.fn().mockResolvedValue([]),
        findForScope: jest.fn().mockResolvedValue(null),
    });

    const buildService = (
        findManyByIds: jest.Mock,
    ): BuildServiceCalculationContextService => {
        const taskRepo = {
            findManyByIds,
        } as unknown as TaskRepositoryPort;
        // Implements FR4 of add-department-head-salary-rules (tasks.md раздел 12) — конструктор
        // приобрёл 4-й параметр; этот describe не проверяет turnoverPerformance, поэтому фейк ничего
        // не находит по умолчанию.
        const turnoverPerformanceReader: TurnoverPerformanceReaderPort = {
            findForScope: jest.fn().mockResolvedValue(null),
        };

        return new BuildServiceCalculationContextService(
            buildDataSource(),
            buildSalesPerformanceReader(),
            taskRepo,
            turnoverPerformanceReader,
        );
    };

    const buildTask = (id: string, status: string) =>
        Task.reconstitute({
            id,
            props: {
                direction: 'service',
                title: 'т',
                description: null,
                deadline: new Date('2026-08-05T00:00:00.000Z'),
                assigneeEmployeeId: 1,
                status: TaskStatus.fromCode(status),
                closedSuccessfullyAt: null,
            },
        });

    it('заполняет taskCompletionStatuses SalaryTask найденной задачи текущего периода', async () => {
        const rule = buildTaskCompletionRule({ '2026-08': 'task-1' });
        const task = buildTask('task-1', 'CLOSED_SUCCESSFULLY');
        const findManyByIds = jest.fn().mockResolvedValue([task]);
        const service = buildService(findManyByIds);

        const context = await service.build(Period.create('2026-08'), 1, [
            rule,
        ]);

        expect(findManyByIds).toHaveBeenCalledWith(['task-1']);
        const entry = context.erpData.taskCompletionStatuses?.[rule.id];
        expect(entry?.taskId).toBe('task-1');
        expect(entry?.isCompleted()).toBe(true);
    });

    it('TaskCompletion-правило без найденной задачи не попадает в taskCompletionStatuses', async () => {
        const rule = buildTaskCompletionRule({ '2026-08': 'missing-task' });
        const findManyByIds = jest.fn().mockResolvedValue([]);
        const service = buildService(findManyByIds);

        const context = await service.build(Period.create('2026-08'), 1, [
            rule,
        ]);

        expect(context.erpData.taskCompletionStatuses).toEqual({});
    });

    it('нет TaskCompletion-правил в переданном наборе — не делает запрос за статусами', async () => {
        const payPerHour = PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Часы',
            targetRole: 'ENGINEER',
            config: { price: 100 },
        });
        const findManyByIds = jest.fn().mockResolvedValue([]);
        const service = buildService(findManyByIds);

        const context = await service.build(Period.create('2026-08'), 1, [
            payPerHour,
        ]);

        expect(findManyByIds).not.toHaveBeenCalled();
        expect(context.erpData.taskCompletionStatuses).toEqual({});
    });
});

// Implements FR2-FR4 of add-department-head-salary-rules.
//
// BuildServiceCalculationContextService — построение departmentSalesPerformance (FR2/FR3) и
// turnoverPerformance (FR4), tasks.md раздел 12. Оба поля резолвятся заранее, по уникальным
// category/(warehouseId, category) скоупам правил DepartmentPercent/DepartmentPlanBonus/
// DepartmentTurnoverBonus переданной схемы — по аналогии с тем, как BuildShopCalculationContextService
// уже пред-резолвит salesPerformanceByCategory для ProductSold (design.md Decision 3).
describe('BuildServiceCalculationContextService — departmentSalesPerformance / turnoverPerformance', () => {
    const period = () => Period.create('2026-08');

    const buildDataSource = (
        departmentId: number | null,
    ): ServiceCalculationDataPort => ({
        findEmployeeIdentities: jest.fn().mockResolvedValue([]),
        findServiceCompletedItems: jest.fn().mockResolvedValue([]),
        findHoursWorked: jest.fn().mockResolvedValue({ fact: 0, prognose: 0 }),
        findOrderPayedItems: jest.fn().mockResolvedValue([]),
        findEmployeeDepartmentId: jest.fn().mockResolvedValue(departmentId),
        findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
        findEmployeeIdentitiesForEmployees: jest
            .fn()
            .mockResolvedValue(new Map()),
        findHoursWorkedForEmployees: jest.fn().mockResolvedValue(new Map()),
    });

    const buildTaskRepo = (): TaskRepositoryPort =>
        ({
            findManyByIds: jest.fn().mockResolvedValue([]),
        }) as unknown as TaskRepositoryPort;

    const buildFakeSalesPerformance = (
        turnover: number,
        margin: number,
        percentCompletion: number,
    ): SalesPerformance =>
        ({
            getFact: () => ({
                getTurnover: () => turnover,
                getMargin: () => margin,
                getPercentCompletion: () => percentCompletion,
            }),
        }) as unknown as SalesPerformance;

    const buildService = (
        dataSource: ServiceCalculationDataPort,
        findForScope: jest.Mock,
        turnoverFindForScope: jest.Mock = jest.fn().mockResolvedValue(null),
    ): BuildServiceCalculationContextService => {
        const salesPerformanceReader: SalesPerformanceReaderPort = {
            listForPeriod: jest.fn().mockResolvedValue([]),
            findForScope,
        };
        const turnoverPerformanceReader: TurnoverPerformanceReaderPort = {
            findForScope: turnoverFindForScope,
        };
        return new BuildServiceCalculationContextService(
            dataSource,
            salesPerformanceReader,
            buildTaskRepo(),
            turnoverPerformanceReader,
        );
    };

    const percentBorders = [
        {
            name: 'A',
            fromPlanPercent: 50,
            multiplier: 0.5,
            mode: 'FIX' as const,
        },
        { name: 'B', fromPlanPercent: 70, multiplier: 1, mode: 'FIX' as const },
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
        warehouseId: number,
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
            const findForScope = jest.fn().mockResolvedValue(null);
            const service = buildService(buildDataSource(null), findForScope);

            const context = await service.build(period(), 1, [
                buildDepartmentPercentRule(null),
            ]);

            expect(context.departmentSalesPerformance).toBeNull();
            expect(findForScope).not.toHaveBeenCalled();
        });

        it('резолвит fact/percentCompletion по собственной category правила', async () => {
            const performance = buildFakeSalesPerformance(100000, 40000, 80);
            const findForScope = jest.fn().mockResolvedValue(performance);
            const service = buildService(buildDataSource(10), findForScope);

            const context = await service.build(period(), 1, [
                buildDepartmentPercentRule('cat-1'),
            ]);

            expect(findForScope).toHaveBeenCalledWith(
                'service',
                '2026-08',
                10,
                'cat-1',
            );
            expect(context.departmentSalesPerformance?.get('cat-1')).toEqual({
                fact: { turnover: 100000, margin: 40000 },
                percentCompletion: 80,
            });
        });

        it('категория без SalesPerformance отсутствует в карте', async () => {
            const findForScope = jest.fn().mockResolvedValue(null);
            const service = buildService(buildDataSource(10), findForScope);

            const context = await service.build(period(), 1, [
                buildDepartmentPercentRule('cat-1'),
            ]);

            expect(context.departmentSalesPerformance?.has('cat-1')).toBe(
                false,
            );
        });

        it('дедуплицирует одинаковую category у нескольких правил — один запрос на неё', async () => {
            // departmentId задан — существующий findSalesPerformance() (department-wide,
            // category: null) тоже делает свой отдельный вызов той же findForScope, не связанный с
            // этим тестом (см. build-service-calculation-context.service.ts) — считаем вызовы
            // именно с category 'cat-1', а не общее число вызовов мока.
            const performance = buildFakeSalesPerformance(1, 1, 1);
            const findForScope = jest.fn().mockResolvedValue(performance);
            const service = buildService(buildDataSource(10), findForScope);

            await service.build(period(), 1, [
                buildDepartmentPercentRule('cat-1'),
                buildDepartmentPlanBonusRule('cat-1'),
            ]);

            const callsForCategory = findForScope.mock.calls.filter(
                ([, , , category]: [string, string, number, string | null]) =>
                    category === 'cat-1',
            );
            expect(callsForCategory).toHaveLength(1);
        });

        it('пустая карта, если в схеме нет правил уровня отдела по продажам — без запросов по category', async () => {
            // departmentId задан — findForScope один раз вызывается существующим
            // findSalesPerformance() (department-wide, category: null); это не входит в скоуп
            // departmentSalesPerformance и не должно давать лишних вызовов с другой category.
            const findForScope = jest.fn().mockResolvedValue(null);
            const service = buildService(buildDataSource(10), findForScope);
            const payPerHour = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'ENGINEER',
                config: { price: 100 },
            });

            const context = await service.build(period(), 1, [payPerHour]);

            expect(context.departmentSalesPerformance).toEqual(new Map());
            expect(findForScope).toHaveBeenCalledTimes(1);
            expect(findForScope).toHaveBeenCalledWith(
                'service',
                '2026-08',
                10,
                null,
            );
        });
    });

    describe('turnoverPerformance', () => {
        it('резолвит факт по warehouseId+category правила DepartmentTurnoverBonus', async () => {
            // category правила ('2') — та же строковая форма, что и во всём остальном config
            // (design.md Decision 2), но фактически несёт числовой RoApp id категории склада —
            // TurnoverPerformanceReaderPort.findForScope принимает его уже распарсенным числом
            // (см. toRoappCategoryId в build-service-calculation-context.service.ts).
            const findForScope = jest.fn().mockResolvedValue(null);
            const turnoverFindForScope = jest.fn().mockResolvedValue(1.5);
            const service = buildService(
                buildDataSource(null),
                findForScope,
                turnoverFindForScope,
            );
            const rule = buildDepartmentTurnoverBonusRule(7, '2');

            const context = await service.build(period(), 1, [rule]);

            expect(turnoverFindForScope).toHaveBeenCalledWith('2026-08', 7, 2);
            expect(
                context.turnoverPerformance.get(
                    turnoverPerformanceScopeKey({
                        warehouseId: 7,
                        category: '2',
                    }),
                ),
            ).toBe(1.5);
        });

        it('дедуплицирует одинаковый scope у нескольких правил — один запрос', async () => {
            const findForScope = jest.fn().mockResolvedValue(null);
            const turnoverFindForScope = jest.fn().mockResolvedValue(2);
            const service = buildService(
                buildDataSource(null),
                findForScope,
                turnoverFindForScope,
            );

            await service.build(period(), 1, [
                buildDepartmentTurnoverBonusRule(7, '2'),
                buildDepartmentTurnoverBonusRule(7, '2'),
            ]);

            expect(turnoverFindForScope).toHaveBeenCalledTimes(1);
        });

        it('хранит null явно, если для scope недостаточно данных', async () => {
            const findForScope = jest.fn().mockResolvedValue(null);
            const turnoverFindForScope = jest.fn().mockResolvedValue(null);
            const service = buildService(
                buildDataSource(null),
                findForScope,
                turnoverFindForScope,
            );
            const key = turnoverPerformanceScopeKey({
                warehouseId: 7,
                category: null,
            });

            const context = await service.build(period(), 1, [
                buildDepartmentTurnoverBonusRule(7, null),
            ]);

            expect(context.turnoverPerformance.has(key)).toBe(true);
            expect(context.turnoverPerformance.get(key)).toBeNull();
        });

        it('пустая карта и без запросов, если в схеме нет DepartmentTurnoverBonus', async () => {
            const findForScope = jest.fn().mockResolvedValue(null);
            const turnoverFindForScope = jest.fn();
            const service = buildService(
                buildDataSource(null),
                findForScope,
                turnoverFindForScope,
            );
            const payPerHour = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'ENGINEER',
                config: { price: 100 },
            });

            const context = await service.build(period(), 1, [payPerHour]);

            expect(context.turnoverPerformance).toEqual(new Map());
            expect(turnoverFindForScope).not.toHaveBeenCalled();
        });
    });
});
