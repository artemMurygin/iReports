import { BuildServiceCalculationContextService } from './build-service-calculation-context.service';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/calculation/service-calculation-data.port';
import type { SalesPerformanceReaderPort } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import type { SalaryTaskRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-task/salary-task.port';
import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { TaskStatus } from '@/domains/service/modules/accounting/domain/value-objects/task-status.value-object';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { Period } from '@/shared/domain/period.value-object';

// Раздел 12 tasks.md (add-task-based-salary-rule) — BuildServiceCalculationContextService
// заполняет erpData.taskCompletionStatuses статусами связанных SalaryTask
// ТЕКУЩЕГО периода для всех TaskCompletion-правил переданной схемы (см.
// design.md Decision 7, calculation-data.types.ts). Остальные поля erpData
// (Фаза 7/8) здесь не переиспытываются заново — покрыты существующими
// вызывающими (GetEmployeeSalaryReportService и т.п.), этот файл сфокусирован
// на новом поведении.
describe('BuildServiceCalculationContextService — taskCompletionStatuses', () => {
    const buildTaskCompletionRule = () =>
        TaskCompletion.create({
            type: 'TaskCompletion',
            name: 'Собрать отчёт по браку',
            targetRole: 'ENGINEER',
            config: {
                bitrixTaskTitle: 'Собрать отчёт по браку за месяц',
                isRecurring: true,
                deadlineTemplate: '2026-08-05',
                defaultAmount: 5000,
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
        findManyByRulesAndPeriod: jest.Mock,
    ): BuildServiceCalculationContextService => {
        const taskRepo = {
            findByRuleAndPeriod: jest.fn(),
            findActiveForDirection: jest.fn(),
            insert: jest.fn(),
            save: jest.fn(),
            findManyByRulesAndPeriod,
            findActiveByRule: jest.fn(),
        } as unknown as SalaryTaskRepositoryPort;

        return new BuildServiceCalculationContextService(
            buildDataSource(),
            buildSalesPerformanceReader(),
            taskRepo,
        );
    };

    it('заполняет taskCompletionStatuses найденной задачей текущего периода', async () => {
        const rule = buildTaskCompletionRule();
        const task = SalaryTask.create({
            salaryRuleId: rule.id,
            period: '2026-08',
            deadline: new Date('2026-08-05T00:00:00.000Z'),
            isRecurring: true,
            bitrixTaskId: 'bx-1',
            taskStatus: TaskStatus.fromRaw('5'),
        });
        const findManyByRulesAndPeriod = jest.fn().mockResolvedValue([task]);
        const service = buildService(findManyByRulesAndPeriod);

        const context = await service.build(Period.create('2026-08'), 1, [
            rule,
        ]);

        expect(findManyByRulesAndPeriod).toHaveBeenCalledWith(
            [rule.id],
            '2026-08',
        );
        expect(context.erpData.taskCompletionStatuses?.[rule.id]).toEqual({
            bitrixTaskId: 'bx-1',
            status: expect.objectContaining({ code: '5' }) as unknown,
        });
    });

    it('TaskCompletion-правило без найденной задачи не попадает в taskCompletionStatuses', async () => {
        const rule = buildTaskCompletionRule();
        const findManyByRulesAndPeriod = jest.fn().mockResolvedValue([]);
        const service = buildService(findManyByRulesAndPeriod);

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
        const findManyByRulesAndPeriod = jest.fn().mockResolvedValue([]);
        const service = buildService(findManyByRulesAndPeriod);

        const context = await service.build(Period.create('2026-08'), 1, [
            payPerHour,
        ]);

        expect(findManyByRulesAndPeriod).not.toHaveBeenCalled();
        expect(context.erpData.taskCompletionStatuses).toEqual({});
    });
});
