import { withRequestContext } from '@/shared/testing/with-request-context';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { TaskStatus } from '@/domains/service/modules/accounting/domain/value-objects/task-status.value-object';
import { SalaryTask, CreateSalaryTaskProps } from './salary-task.entity';

// Раздел 9 tasks.md (add-task-based-salary-rule): доменная сущность поверх
// Prisma-модели SalaryTask (задача 1.1, общая таблица service/shop) —
// направление 'service', см. WHY в salary-task.repository.ts (изоляция на
// уровне кода, backend/CLAUDE.md "Общие таблицы между service и shop").
describe('SalaryTask', () => {
    const baseProps = (): CreateSalaryTaskProps => ({
        salaryRuleId: 'rule-1',
        period: '2026-09',
        deadline: new Date('2026-09-30T23:59:59.000Z'),
        isRecurring: true,
        bitrixTaskId: '777',
        taskStatus: TaskStatus.fromRaw('2'),
    });

    describe('create', () => {
        it('генерирует id и сохраняет переданные props, lastSyncedAt по умолчанию null', () => {
            withRequestContext(() => {
                const task = SalaryTask.create(baseProps());

                expect(task.id).toEqual(expect.any(String));
                expect(task.salaryRuleId).toBe('rule-1');
                expect(task.period).toBe('2026-09');
                expect(task.deadline).toEqual(
                    new Date('2026-09-30T23:59:59.000Z'),
                );
                expect(task.isRecurring).toBe(true);
                expect(task.bitrixTaskId).toBe('777');
                expect(task.taskStatus.code).toBe('2');
                expect(task.lastSyncedAt).toBeNull();
            });
        });

        it('принимает явный lastSyncedAt (реконструкция из персистентности)', () => {
            withRequestContext(() => {
                const lastSyncedAt = new Date('2026-09-05T10:00:00.000Z');
                const task = SalaryTask.create({
                    ...baseProps(),
                    lastSyncedAt,
                });

                expect(task.lastSyncedAt).toEqual(lastSyncedAt);
            });
        });

        it('выбрасывает ArgumentInvalidException без bitrixTaskId', () => {
            withRequestContext(() => {
                expect(() =>
                    SalaryTask.create({ ...baseProps(), bitrixTaskId: '' }),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('выбрасывает ArgumentInvalidException без deadline', () => {
            withRequestContext(() => {
                expect(() =>
                    SalaryTask.create({
                        ...baseProps(),
                        deadline: undefined as unknown as Date,
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('выбрасывает ArgumentInvalidException без salaryRuleId', () => {
            withRequestContext(() => {
                expect(() =>
                    SalaryTask.create({ ...baseProps(), salaryRuleId: '' }),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('выбрасывает ArgumentInvalidException без period', () => {
            withRequestContext(() => {
                expect(() =>
                    SalaryTask.create({ ...baseProps(), period: '' }),
                ).toThrow(ArgumentInvalidException);
            });
        });
    });

    describe('markStatus', () => {
        it('меняет taskStatus прямой мутацией props, не трогая остальные поля', () => {
            withRequestContext(() => {
                const task = SalaryTask.create(baseProps());

                task.markStatus(TaskStatus.fromRaw('5'));

                expect(task.taskStatus.code).toBe('5');
                expect(task.taskStatus.isDone()).toBe(true);
                expect(task.bitrixTaskId).toBe('777');
                expect(task.salaryRuleId).toBe('rule-1');
                expect(task.period).toBe('2026-09');
            });
        });
    });
});
