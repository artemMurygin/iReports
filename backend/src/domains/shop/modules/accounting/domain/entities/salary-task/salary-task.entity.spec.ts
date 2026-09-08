import { ShopSalaryTask } from './salary-task.entity';

// openspec/changes/replace-bitrix-task-integration, design.md решение 5 /
// architecture.md (Entities: SalaryTask) — независимая копия для
// направления shop (issue #57, зеркало domains/service/modules/accounting/
// domain/entities/salary-task/salary-task.entity.spec.ts, не
// переиспользует ни класс, ни тест сервиса). Заменяет прежний
// ShopSalaryTask (задача Bitrix24 salary_tasks) — теперь это эфемерная
// (не персистентная) Entity поверх сырых данных Task (src/modules/tasks),
// созданная прямо в task-completion-statuses.builder.ts.
describe('ShopSalaryTask', () => {
    describe('create', () => {
        it('создаёт сущность с identity = taskId и заданным статусом', () => {
            const task = ShopSalaryTask.create({
                taskId: 'task-1',
                status: 'IN_PROGRESS',
            });

            expect(task.taskId).toBe('task-1');
            expect(task.id).toBe('task-1');
            expect(task.status).toBe('IN_PROGRESS');
        });
    });

    describe('isCompleted', () => {
        // design.md Decision 3/5 — только CLOSED_SUCCESSFULLY запускает
        // начисление правила TaskCompletion, НЕ DONE и не любой другой
        // терминальный статус.
        it('true только для статуса CLOSED_SUCCESSFULLY', () => {
            const task = ShopSalaryTask.create({
                taskId: 'task-1',
                status: 'CLOSED_SUCCESSFULLY',
            });

            expect(task.isCompleted()).toBe(true);
        });

        it.each([
            'NEW',
            'IN_PROGRESS',
            'DONE',
            'REWORK',
            'CLOSED_UNSUCCESSFULLY',
        ])('false для статуса %s', (status) => {
            const task = ShopSalaryTask.create({ taskId: 'task-1', status });

            expect(task.isCompleted()).toBe(false);
        });
    });
});
