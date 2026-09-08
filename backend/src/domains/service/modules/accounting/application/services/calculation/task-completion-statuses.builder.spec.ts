import { withRequestContext } from '@/shared/testing/with-request-context';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import {
    buildTaskCompletionStatuses,
    findTaskCompletionTasks,
    taskCompletionFreshnessStamp,
    taskCompletionStatusesFromTasks,
} from './task-completion-statuses.builder';

// replace-bitrix-task-integration, design.md решение 5 — единственное
// место, кроме HTTP tasks, что инжектит TASK_REPOSITORY напрямую (без
// Port/Adapter): собирает taskId из config.taskIdByPeriod[period] каждого
// TaskCompletion-правила, зовёт TASK_REPOSITORY.findManyByIds() и
// конструирует SalaryTask.create({taskId, status}) на месте.
describe('task-completion-statuses.builder', () => {
    // Конструируется напрямую (не через TaskCompletion.create()), т.к.
    // create() всегда пишет taskId в taskIdByPeriod ТЕКУЩЕГО периода
    // (Period.current()) — тестам этого файла нужен произвольный период
    // ('2026-08'), не привязанный к системной дате.
    const buildTaskCompletionRule = (taskIdByPeriod: Record<string, string>) =>
        withRequestContext(
            () =>
                new TaskCompletion({
                    id: 'rule-1',
                    props: {
                        name: 'Сдать отчёт',
                        type: 'TaskCompletion',
                        targetRole: 'ENGINEER',
                        config: {
                            taskIdByPeriod,
                            taskTitleTemplate: 'Сдать отчёт по браку',
                            isRecurring: true,
                            deadlineTemplate: '2026-08-05',
                            defaultAmount: 5000,
                        },
                    },
                }),
        );

    const buildTask = (id: string, status: string, updatedAt: Date) =>
        Task.reconstitute({
            id,
            createdAt: updatedAt,
            updatedAt,
            props: {
                direction: 'service',
                title: 'т',
                description: null,
                deadline: new Date('2026-08-05T00:00:00.000Z'),
                assigneeEmployeeId: 1,
                status: { code: status } as never,
                closedSuccessfullyAt: null,
            },
        });

    const buildRepo = (
        tasks: Task[],
    ): {
        repo: TaskRepositoryPort;
        findManyByIds: jest.Mock;
    } => {
        const findManyByIds = jest
            .fn()
            .mockImplementation((ids: string[]) =>
                Promise.resolve(tasks.filter((t) => ids.includes(t.id))),
            );
        const repo = { findManyByIds } as unknown as TaskRepositoryPort;
        return { repo, findManyByIds };
    };

    it('правило без taskIdByPeriod[period] — не попадает в результат, TASK_REPOSITORY не вызывается', async () => {
        const rule = buildTaskCompletionRule({});
        const { repo, findManyByIds } = buildRepo([]);

        const refs = await findTaskCompletionTasks(repo, [rule], '2026-08');

        expect(refs).toEqual([]);
        expect(findManyByIds).not.toHaveBeenCalled();
    });

    it('правило без TaskCompletion-типа не участвует в сборке (PayPerHour и т.п.)', async () => {
        const other = withRequestContext(() =>
            PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'ENGINEER',
                config: { price: 100 },
            }),
        );
        const { repo, findManyByIds } = buildRepo([]);

        const refs = await findTaskCompletionTasks(repo, [other], '2026-08');

        expect(refs).toEqual([]);
        expect(findManyByIds).not.toHaveBeenCalled();
    });

    it('находит taskId правила текущего периода и вызывает findManyByIds одним батчем', async () => {
        const rule = buildTaskCompletionRule({ '2026-08': 'task-1' });
        const task = buildTask(
            'task-1',
            'CLOSED_SUCCESSFULLY',
            new Date('2026-08-10T00:00:00.000Z'),
        );
        const { repo, findManyByIds } = buildRepo([task]);

        const refs = await findTaskCompletionTasks(repo, [rule], '2026-08');

        expect(findManyByIds).toHaveBeenCalledWith(['task-1']);
        expect(refs).toEqual([{ ruleId: rule.id, task }]);
    });

    it('taskId сохранён в config, но TASK_REPOSITORY не вернул такую задачу (осиротевшая/удалённая ссылка) — правило пропускается', async () => {
        const rule = buildTaskCompletionRule({ '2026-08': 'missing-task' });
        const { repo } = buildRepo([]);

        const refs = await findTaskCompletionTasks(repo, [rule], '2026-08');

        expect(refs).toEqual([]);
    });

    it('buildTaskCompletionStatuses строит карту по ruleId с SalaryTask.isCompleted() из статуса задачи', async () => {
        const rule = buildTaskCompletionRule({ '2026-08': 'task-1' });
        const task = buildTask(
            'task-1',
            'CLOSED_SUCCESSFULLY',
            new Date('2026-08-10T00:00:00.000Z'),
        );
        const { repo } = buildRepo([task]);

        const statuses = await buildTaskCompletionStatuses(
            repo,
            [rule],
            '2026-08',
        );

        expect(statuses[rule.id].taskId).toBe('task-1');
        expect(statuses[rule.id].isCompleted()).toBe(true);
    });

    it('taskCompletionStatusesFromTasks не считает isCompleted() для промежуточного статуса', () => {
        const rule = buildTaskCompletionRule({ '2026-08': 'task-1' });
        const task = buildTask(
            'task-1',
            'DONE',
            new Date('2026-08-10T00:00:00.000Z'),
        );

        const statuses = taskCompletionStatusesFromTasks([
            { ruleId: rule.id, task },
        ]);

        expect(statuses[rule.id].isCompleted()).toBe(false);
    });

    it('taskCompletionFreshnessStamp считает по максимальному updatedAt среди задач, "never" для пустого списка', () => {
        const older = buildTask(
            't1',
            'DONE',
            new Date('2026-08-01T00:00:00.000Z'),
        );
        const newer = buildTask(
            't2',
            'DONE',
            new Date('2026-08-20T00:00:00.000Z'),
        );

        const stamp = taskCompletionFreshnessStamp([
            { ruleId: 'r1', task: older },
            { ruleId: 'r2', task: newer },
        ]);
        const emptyStamp = taskCompletionFreshnessStamp([]);

        expect(stamp).toContain(newer.updatedAt.toISOString());
        expect(emptyStamp).toBe('never');
    });
});
