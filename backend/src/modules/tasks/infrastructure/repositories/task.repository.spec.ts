import { withRequestContext } from '@/shared/testing/with-request-context';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import { TaskStatus } from '@/modules/tasks/domain/value-objects/task-status.value-object';
import { TaskRepository } from './task.repository';

// specs/tasks/spec.md — insert/update персистят агрегат корректно
// (включая переживание transitionTo — статус, closedSuccessfullyAt),
// findManyByIds/findById/findMany с фильтром. По прецеденту
// work-schedule-entry.repository.spec.ts: мокается Prisma-клиент на
// границе, а не поднимается реальная БД — сама механика запроса (что
// именно передаётся в Prisma) важнее для этого юнит-теста, чем факт записи
// в реальную таблицу.
describe('TaskRepository', () => {
    const buildTask = () =>
        withRequestContext(() =>
            Task.create({
                title: 'Сдать отчёт',
                description: 'Проверить цифры',
                deadline: new Date('2026-09-30T00:00:00.000Z'),
                assigneeEmployeeId: 42,
                direction: 'service',
            }),
        );

    const buildRepository = () => {
        const create = jest.fn();
        const update = jest.fn();
        const findUnique = jest.fn();
        const findMany = jest.fn();
        const client = { task: { create, update, findUnique, findMany } };
        const db = {
            getClient: () => client,
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        return {
            repository: new TaskRepository(db),
            create,
            update,
            findUnique,
            findMany,
        };
    };

    describe('insert', () => {
        it('передаёт все поля агрегата в Prisma create', async () => {
            const { repository, create } = buildRepository();
            create.mockResolvedValueOnce({});
            const task = buildTask();

            await withRequestContext(() => repository.insert(task));

            expect(create).toHaveBeenCalledTimes(1);
            expect(create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    id: task.id,
                    title: 'Сдать отчёт',
                    description: 'Проверить цифры',
                    assigneeEmployeeId: 42,
                    direction: 'service',
                    status: 'NEW',
                    closedSuccessfullyAt: null,
                }) as unknown,
            });
        });
    });

    describe('update', () => {
        it('переживает transitionTo: статус и closedSuccessfullyAt доходят до Prisma', async () => {
            const { repository, update } = buildRepository();
            update.mockResolvedValueOnce({});
            const task = buildTask();
            withRequestContext(() => {
                task.transitionTo(TaskStatus.fromCode('IN_PROGRESS'), 42);
                task.transitionTo(TaskStatus.fromCode('DONE'), 42);
                task.transitionTo(
                    TaskStatus.fromCode('CLOSED_SUCCESSFULLY'),
                    7,
                );
            });

            await withRequestContext(() => repository.update(task));

            expect(update).toHaveBeenCalledTimes(1);
            expect(update).toHaveBeenCalledWith({
                where: { id: task.id },
                data: expect.objectContaining({
                    status: 'CLOSED_SUCCESSFULLY',
                    closedSuccessfullyAt: task.closedSuccessfullyAt,
                }) as unknown,
            });
        });
    });

    describe('findById', () => {
        it('возвращает null, если запись не найдена', async () => {
            const { repository, findUnique } = buildRepository();
            findUnique.mockResolvedValueOnce(null);

            await expect(repository.findById('missing')).resolves.toBeNull();
            expect(findUnique).toHaveBeenCalledWith({
                where: { id: 'missing' },
            });
        });

        it('маппит найденную запись в доменную сущность', async () => {
            const { repository, findUnique } = buildRepository();
            const now = new Date('2026-09-01T00:00:00.000Z');
            findUnique.mockResolvedValueOnce({
                id: 'task-1',
                direction: 'service',
                title: 'Задача',
                description: null,
                deadline: new Date('2026-09-30T00:00:00.000Z'),
                assigneeEmployeeId: 42,
                status: 'NEW',
                closedSuccessfullyAt: null,
                createdAt: now,
                updatedAt: now,
            });

            const found = await repository.findById('task-1');
            expect(found).not.toBeNull();
            expect(found!.id).toBe('task-1');
            expect(found!.status.code).toBe('NEW');
        });
    });

    describe('findManyByIds', () => {
        it('возвращает [] без похода в Prisma для пустого списка id', async () => {
            const { repository, findMany } = buildRepository();

            const result = await repository.findManyByIds([]);

            expect(result).toEqual([]);
            expect(findMany).not.toHaveBeenCalled();
        });

        it('запрашивает только переданные id и маппит найденные', async () => {
            const { repository, findMany } = buildRepository();
            const now = new Date('2026-09-01T00:00:00.000Z');
            findMany.mockResolvedValueOnce([
                {
                    id: 'task-1',
                    direction: 'service',
                    title: 'Задача 1',
                    description: null,
                    deadline: now,
                    assigneeEmployeeId: 42,
                    status: 'DONE',
                    closedSuccessfullyAt: null,
                    createdAt: now,
                    updatedAt: now,
                },
            ]);

            const result = await repository.findManyByIds([
                'task-1',
                'missing-id',
            ]);

            expect(findMany).toHaveBeenCalledWith({
                where: { id: { in: ['task-1', 'missing-id'] } },
            });
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('task-1');
        });
    });

    describe('findMany', () => {
        it('фильтрует по status/direction', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            await repository.findMany({
                status: 'IN_PROGRESS',
                direction: 'shop',
            });

            expect(findMany).toHaveBeenCalledWith({
                where: { status: 'IN_PROGRESS', direction: 'shop' },
                orderBy: { createdAt: 'desc' },
            });
        });

        it('без фильтра — where пустой', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            await repository.findMany({});

            expect(findMany).toHaveBeenCalledWith({
                where: {},
                orderBy: { createdAt: 'desc' },
            });
        });
    });
});
