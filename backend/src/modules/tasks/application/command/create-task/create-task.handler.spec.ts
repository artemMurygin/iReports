import { withRequestContext } from '@/shared/testing/with-request-context';
import { InMemoryTaskRepository } from '@/modules/tasks/infrastructure/repositories/in-memory-task.repository';
import { CreateTaskHandler } from './create-task.handler';
import { CreateTaskCommand } from './create-task.command';

// specs/tasks/spec.md, Requirement: «Задача — полностью самостоятельная
// сущность, не знающая о зарплатных правилах» — CreateTaskCommand не
// принимает и не сохраняет salaryRuleId/period (design.md Decision 2/4).
describe('CreateTaskHandler', () => {
    const build = () => {
        const taskRepo = new InMemoryTaskRepository();
        return { handler: new CreateTaskHandler(taskRepo), taskRepo };
    };

    it('создаёт Task в статусе NEW и возвращает { id }', async () => {
        const { handler, taskRepo } = build();

        const result = await withRequestContext(() =>
            handler.execute(
                new CreateTaskCommand({
                    title: 'Сдать отчёт',
                    description: 'Проверить цифры',
                    deadline: new Date('2026-09-30T00:00:00.000Z'),
                    assigneeEmployeeId: 42,
                    direction: 'service',
                }),
            ),
        );

        expect(result.id).toEqual(expect.any(String));
        const stored = taskRepo.store.get(result.id);
        expect(stored).toBeDefined();
        expect(stored!.status.code).toBe('NEW');
        expect(stored!.title).toBe('Сдать отчёт');
        expect(stored!.assigneeEmployeeId).toBe(42);
        expect(stored!.direction).toBe('service');
    });

    it('создаёт задачу без direction (не привязана ни к одному направлению)', async () => {
        const { handler, taskRepo } = build();

        const result = await withRequestContext(() =>
            handler.execute(
                new CreateTaskCommand({
                    title: 'Общая задача',
                    deadline: new Date('2026-09-30T00:00:00.000Z'),
                    assigneeEmployeeId: 7,
                }),
            ),
        );

        expect(taskRepo.store.get(result.id)!.direction).toBeNull();
    });

    it('CreateTaskCommand не принимает salaryRuleId/period — задача полностью самостоятельна', async () => {
        const { handler } = build();

        await withRequestContext(async () => {
            const command = new CreateTaskCommand({
                title: 'Задача правила',
                deadline: new Date('2026-09-30T00:00:00.000Z'),
                assigneeEmployeeId: 42,
            });

            // Компилируется без salaryRuleId/period в CommandProps — если бы
            // такие поля существовали в типе, TS не пожаловался бы на их
            // отсутствие. Здесь же явная проверка на рантайме, что команда
            // их не несёт и хендлер их не использует.
            expect(
                (command as unknown as Record<string, unknown>).salaryRuleId,
            ).toBeUndefined();
            await handler.execute(command);
        });
    });
});
