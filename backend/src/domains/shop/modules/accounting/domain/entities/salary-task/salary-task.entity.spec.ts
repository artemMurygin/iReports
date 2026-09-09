import { ShopSalaryTask } from './salary-task.entity';
import { ShopTaskStatus } from '../../value-objects/task-status.value-object';
import { Period } from '@/shared/domain/period.value-object';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Раздел 14 tasks.md (add-task-based-salary-rule) — независимая копия
// теста (зеркало domains/service/modules/accounting/domain/entities/
// salary-task/salary-task.entity.spec.ts, раздел 9, issue #57).
describe('ShopSalaryTask', () => {
    const validProps = () => ({
        salaryRuleId: 'rule-1',
        period: Period.create('2026-09'),
        deadline: new Date('2026-09-25T00:00:00.000Z'),
        isRecurring: true,
        bitrixTaskId: 'bx-task-1',
        taskStatus: ShopTaskStatus.done(),
    });

    describe('create', () => {
        it('создаёт задачу с валидными обязательными полями', () => {
            withRequestContext(() => {
                const task = ShopSalaryTask.create(validProps());

                expect(task.salaryRuleId).toBe('rule-1');
                expect(task.bitrixTaskId).toBe('bx-task-1');
                expect(task.isRecurring).toBe(true);
                expect(task.lastSyncedAt).toBeNull();
            });
        });

        it('требует bitrixTaskId — падает без него', () => {
            withRequestContext(() => {
                expect(() =>
                    ShopSalaryTask.create({
                        ...validProps(),
                        bitrixTaskId: '',
                    }),
                ).toThrow();
            });
        });

        it('требует deadline — падает без него', () => {
            withRequestContext(() => {
                expect(() =>
                    ShopSalaryTask.create({
                        ...validProps(),
                        deadline: undefined as unknown as Date,
                    }),
                ).toThrow();
            });
        });

        it('требует salaryRuleId — падает без него', () => {
            withRequestContext(() => {
                expect(() =>
                    ShopSalaryTask.create({
                        ...validProps(),
                        salaryRuleId: '',
                    }),
                ).toThrow();
            });
        });
    });

    describe('markStatus', () => {
        it('обновляет taskStatus и lastSyncedAt', () => {
            withRequestContext(() => {
                const task = ShopSalaryTask.create(validProps());
                const syncedAt = new Date('2026-09-10T12:00:00.000Z');

                task.markStatus(ShopTaskStatus.fromRaw('3'), syncedAt);

                expect(task.taskStatus.getValue()).toBe('3');
                expect(task.lastSyncedAt).toEqual(syncedAt);
            });
        });
    });
});
