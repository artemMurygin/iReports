import { withRequestContext } from '@/shared/testing/with-request-context';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { SalaryTask, CreateSalaryTaskProps } from './salary-task.entity';

// replace-bitrix-task-integration, design.md решение 5: Entity accounting
// поверх сырых данных src/modules/tasks — НЕ персистентная, создаётся
// прямо в task-completion-statuses.builder.ts из Task[], полученного
// TASK_REPOSITORY.findManyByIds() (без Port/Adapter). identity — сам
// taskId (совпадает с id связанной Task), status — сырой код статуса
// ('NEW'/'IN_PROGRESS'/'DONE'/'CLOSED_SUCCESSFULLY'/'CLOSED_UNSUCCESSFULLY'/
// 'REWORK'), не через TaskStatus VO модуля tasks.
describe('SalaryTask', () => {
    const baseProps = (): CreateSalaryTaskProps => ({
        taskId: 'task-1',
        status: 'IN_PROGRESS',
    });

    describe('create', () => {
        it('сохраняет taskId как identity и статус как есть', () => {
            withRequestContext(() => {
                const task = SalaryTask.create(baseProps());

                expect(task.id).toBe('task-1');
                expect(task.taskId).toBe('task-1');
                expect(task.status).toBe('IN_PROGRESS');
            });
        });

        it('выбрасывает ArgumentInvalidException без taskId', () => {
            withRequestContext(() => {
                expect(() =>
                    SalaryTask.create({ ...baseProps(), taskId: '' }),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('выбрасывает ArgumentInvalidException без status', () => {
            withRequestContext(() => {
                expect(() =>
                    SalaryTask.create({ ...baseProps(), status: '' }),
                ).toThrow(ArgumentInvalidException);
            });
        });
    });

    // design.md решение 3/5: только CLOSED_SUCCESSFULLY запускает
    // начисление правила TaskCompletion — бизнес-правило "что считается
    // выполненным" описано здесь, локально в accounting, а не
    // делегируется в TaskStatus модуля tasks.
    describe('isCompleted', () => {
        it('возвращает true только для статуса CLOSED_SUCCESSFULLY', () => {
            withRequestContext(() => {
                expect(
                    SalaryTask.create({
                        taskId: 't',
                        status: 'CLOSED_SUCCESSFULLY',
                    }).isCompleted(),
                ).toBe(true);
            });
        });

        it.each([
            'NEW',
            'IN_PROGRESS',
            'DONE',
            'REWORK',
            'CLOSED_UNSUCCESSFULLY',
        ])('возвращает false для статуса %s', (status) => {
            withRequestContext(() => {
                expect(
                    SalaryTask.create({ taskId: 't', status }).isCompleted(),
                ).toBe(false);
            });
        });
    });
});
