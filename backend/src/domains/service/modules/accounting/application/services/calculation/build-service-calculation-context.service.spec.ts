import { BuildServiceCalculationContextService } from './build-service-calculation-context.service';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/calculation/service-calculation-data.port';
import type { SalesPerformanceReaderPort } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import { TaskStatus } from '@/modules/tasks/domain/value-objects/task-status.value-object';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
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

        return new BuildServiceCalculationContextService(
            buildDataSource(),
            buildSalesPerformanceReader(),
            taskRepo,
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
