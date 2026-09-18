import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { Task } from './task.entity';
import { TaskStatus } from '../value-objects/task-status.value-object';
import {
    InvalidTaskTransitionException,
    TaskAlreadyClosedException,
} from '../exceptions/task.exception';

// specs/tasks/spec.md — Task.create/transitionTo/cancelForRuleDeletion.
describe('Task entity', () => {
    const buildTask = () =>
        withRequestContext(() =>
            Task.create({
                title: 'Согласовать отчёт',
                description: 'Сверить цифры с бухгалтерией',
                deadline: new Date('2026-09-30T00:00:00.000Z'),
                assigneeEmployeeId: 42,
                direction: 'service',
            }),
        );

    describe('create', () => {
        it('стартует в статусе NEW', () => {
            const task = buildTask();
            expect(task.status.code).toBe('NEW');
        });

        it('не имеет closedSuccessfullyAt сразу после создания', () => {
            const task = buildTask();
            expect(task.closedSuccessfullyAt).toBeNull();
        });

        it('не хранит и не принимает salaryRuleId/period (задача самостоятельна — specs/tasks/spec.md)', () => {
            const task = buildTask();
            // Task.create не принимает ничего похожего на
            // salaryRuleId/period/isRecurring — по типам TaskCreateProps;
            // здесь фиксируем, что готовая сущность тоже не выставляет
            // таких полей наружу.
            expect(
                (task as unknown as Record<string, unknown>).salaryRuleId,
            ).toBeUndefined();
            expect((task as unknown as Record<string, unknown>).period).toBe(
                undefined,
            );
        });
    });

    describe('transitionTo', () => {
        it('применяет допустимый переход (NEW → IN_PROGRESS)', () => {
            const task = buildTask();
            withRequestContext(() =>
                task.transitionTo(TaskStatus.fromCode('IN_PROGRESS'), 42),
            );
            expect(task.status.code).toBe('IN_PROGRESS');
        });

        it('бросает InvalidTaskTransitionException на недопустимом переходе и не меняет статус', () => {
            const task = buildTask();
            expect(() =>
                withRequestContext(() =>
                    task.transitionTo(
                        TaskStatus.fromCode('CLOSED_SUCCESSFULLY'),
                        42,
                    ),
                ),
            ).toThrow(InvalidTaskTransitionException);
            expect(task.status.code).toBe('NEW');
        });

        it('переход в CLOSED_SUCCESSFULLY проставляет closedSuccessfullyAt', () => {
            const task = buildTask();
            withRequestContext(() => {
                task.transitionTo(TaskStatus.fromCode('IN_PROGRESS'), 42);
                task.transitionTo(TaskStatus.fromCode('DONE'), 42);
                task.transitionTo(
                    TaskStatus.fromCode('CLOSED_SUCCESSFULLY'),
                    7,
                );
            });
            expect(task.closedSuccessfullyAt).toBeInstanceOf(Date);
        });

        it('любой другой допустимый переход НЕ проставляет closedSuccessfullyAt', () => {
            const task = buildTask();
            withRequestContext(() => {
                task.transitionTo(TaskStatus.fromCode('IN_PROGRESS'), 42);
                task.transitionTo(TaskStatus.fromCode('DONE'), 42);
                task.transitionTo(
                    TaskStatus.fromCode('CLOSED_UNSUCCESSFULLY'),
                    7,
                );
            });
            expect(task.closedSuccessfullyAt).toBeNull();
        });
    });

    describe('cancelForRuleDeletion', () => {
        it.each(['NEW', 'IN_PROGRESS', 'DONE', 'REWORK'])(
            'переводит задачу из %s в CLOSED_UNSUCCESSFULLY',
            (fromCode) => {
                const task = buildTask();
                withRequestContext(() => {
                    // Довести задачу до нужного нетерминального статуса по
                    // разрешённому графу перед тем, как отменить.
                    if (fromCode !== 'NEW') {
                        task.transitionTo(
                            TaskStatus.fromCode('IN_PROGRESS'),
                            42,
                        );
                    }
                    if (fromCode === 'DONE' || fromCode === 'REWORK') {
                        task.transitionTo(TaskStatus.fromCode('DONE'), 42);
                    }
                    if (fromCode === 'REWORK') {
                        task.transitionTo(TaskStatus.fromCode('REWORK'), 7);
                    }
                    task.cancelForRuleDeletion();
                });
                expect(task.status.code).toBe('CLOSED_UNSUCCESSFULLY');
            },
        );

        it('no-op, если задача уже CLOSED_SUCCESSFULLY', () => {
            const task = buildTask();
            withRequestContext(() => {
                task.transitionTo(TaskStatus.fromCode('IN_PROGRESS'), 42);
                task.transitionTo(TaskStatus.fromCode('DONE'), 42);
                task.transitionTo(
                    TaskStatus.fromCode('CLOSED_SUCCESSFULLY'),
                    7,
                );
                task.cancelForRuleDeletion();
            });
            expect(task.status.code).toBe('CLOSED_SUCCESSFULLY');
        });

        it('no-op, если задача уже CLOSED_UNSUCCESSFULLY', () => {
            const task = buildTask();
            withRequestContext(() => {
                task.transitionTo(TaskStatus.fromCode('IN_PROGRESS'), 42);
                task.transitionTo(TaskStatus.fromCode('DONE'), 42);
                task.transitionTo(
                    TaskStatus.fromCode('CLOSED_UNSUCCESSFULLY'),
                    7,
                );
                task.cancelForRuleDeletion();
            });
            expect(task.status.code).toBe('CLOSED_UNSUCCESSFULLY');
        });
    });

    // openspec/changes/edit-task/specs/tasks/spec.md, Requirement:
    // «Редактирование полей активной задачи».
    describe('update', () => {
        it('применяет частичный патч к нетерминальной задаче (NEW) — меняются только переданные поля', () => {
            const task = buildTask();
            withRequestContext(() => task.update({ title: 'Новое название' }));
            expect(task.title).toBe('Новое название');
            expect(task.description).toBe('Сверить цифры с бухгалтерией');
            expect(task.deadline).toEqual(new Date('2026-09-30T00:00:00.000Z'));
            expect(task.assigneeEmployeeId).toBe(42);
        });

        it('применяет частичный патч к нетерминальной задаче (IN_PROGRESS) — меняются только переданные поля', () => {
            const task = buildTask();
            withRequestContext(() => {
                task.transitionTo(TaskStatus.fromCode('IN_PROGRESS'), 42);
                task.update({
                    deadline: new Date('2026-10-15T00:00:00.000Z'),
                    assigneeEmployeeId: 7,
                });
            });
            expect(task.title).toBe('Согласовать отчёт');
            expect(task.description).toBe('Сверить цифры с бухгалтерией');
            expect(task.deadline).toEqual(new Date('2026-10-15T00:00:00.000Z'));
            expect(task.assigneeEmployeeId).toBe(7);
        });

        it('обновляет несколько полей сразу', () => {
            const task = buildTask();
            withRequestContext(() =>
                task.update({
                    title: 'Другое название',
                    description: 'Другое описание',
                }),
            );
            expect(task.title).toBe('Другое название');
            expect(task.description).toBe('Другое описание');
            expect(task.deadline).toEqual(new Date('2026-09-30T00:00:00.000Z'));
            expect(task.assigneeEmployeeId).toBe(42);
        });

        it('бросает TaskAlreadyClosedException и не меняет поля, если задача CLOSED_SUCCESSFULLY', () => {
            const task = buildTask();
            withRequestContext(() => {
                task.transitionTo(TaskStatus.fromCode('IN_PROGRESS'), 42);
                task.transitionTo(TaskStatus.fromCode('DONE'), 42);
                task.transitionTo(
                    TaskStatus.fromCode('CLOSED_SUCCESSFULLY'),
                    7,
                );
            });
            expect(() =>
                withRequestContext(() =>
                    task.update({ title: 'Попытка изменить' }),
                ),
            ).toThrow(TaskAlreadyClosedException);
            expect(task.title).toBe('Согласовать отчёт');
        });

        it('бросает TaskAlreadyClosedException и не меняет поля, если задача CLOSED_UNSUCCESSFULLY', () => {
            const task = buildTask();
            withRequestContext(() => {
                task.transitionTo(TaskStatus.fromCode('IN_PROGRESS'), 42);
                task.transitionTo(TaskStatus.fromCode('DONE'), 42);
                task.transitionTo(
                    TaskStatus.fromCode('CLOSED_UNSUCCESSFULLY'),
                    7,
                );
            });
            expect(() =>
                withRequestContext(() =>
                    task.update({ title: 'Попытка изменить' }),
                ),
            ).toThrow(TaskAlreadyClosedException);
            expect(task.title).toBe('Согласовать отчёт');
        });

        it('update({ title: "" }) на нетерминальной задаче бросает ArgumentInvalidException', () => {
            const task = buildTask();
            expect(() =>
                withRequestContext(() => task.update({ title: '' })),
            ).toThrow(ArgumentInvalidException);
        });
    });
});
