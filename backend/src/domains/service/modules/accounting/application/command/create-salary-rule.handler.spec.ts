import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateSalaryRuleHandler } from './create-salary-rule.handler';
import { CreateSalaryRuleCommand } from './create-salary-rule.command';
import type { SalaryRuleRepositoryPort } from '../ports/salary-rule.port';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import { TaskRuleRequiresEmployeeTargetException } from '@/domains/service/modules/accounting/domain/exceptions/task-rule.exception';
import type { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';

describe('CreateSalaryRuleHandler', () => {
    const buildHandler = (overrides?: {
        insertImpl?: () => Promise<void>;
        createTaskId?: number;
    }) => {
        const insert = jest
            .fn<Promise<void>, [SalaryRule, { motivationSchemaId: string }]>()
            .mockImplementation(
                overrides?.insertImpl ?? (() => Promise.resolve()),
            );
        const salaryRuleRepo: SalaryRuleRepositoryPort = {
            insert,
            deleteAllByMotivationSchema: jest.fn().mockResolvedValue(undefined),
            findById: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue(undefined),
        };
        const createTask = jest
            .fn<Promise<number>, [unknown]>()
            .mockResolvedValue(overrides?.createTaskId ?? 3711);
        const deleteTask = jest
            .fn<Promise<void>, [number]>()
            .mockResolvedValue(undefined);
        const bitrixTasksService = {
            createTask,
            deleteTask,
        } as unknown as BitrixTasksService;
        const handler = new CreateSalaryRuleHandler(
            salaryRuleRepo,
            bitrixTasksService,
        );
        return { handler, insert, createTask, deleteTask };
    };

    it('создаёт правило нужного типа через SalaryRuleFactory и сохраняет его', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler();
            const command = new CreateSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                rule: {
                    type: 'PayPerHour',
                    name: 'Часы',
                    targetRole: 'ENGINEER',
                    config: { price: 200 },
                },
            });

            await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(1);
            const [entity, meta] = insert.mock.calls[0];
            expect(entity).toBeInstanceOf(PayPerHoursEntity);
            expect(
                entity.calculate({
                    employee: { id: 1, identities: [] },
                    period: {
                        direction: 'service',
                        period: '2026-08',
                        from: new Date('2026-08-01T00:00:00.000Z'),
                        to: new Date('2026-08-31T23:59:59.999Z'),
                        status: 'OPEN',
                    },
                    mode: 'FACT',
                    erpData: {
                        serviceCompletedItems: [],
                        hoursWorked: { fact: 5, prognose: 5 },
                    },
                    salesPerformance: null,
                }).amount,
            ).toBe(1000);
            expect(meta).toEqual({ motivationSchemaId: 'schema-1' });
        });
    });

    it('возвращает id созданного правила', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler();
            const command = new CreateSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                rule: {
                    type: 'ServiceCompleted',
                    name: 'Услуги',
                    targetRole: 'ENGINEER',
                    config: { award: { type: 'ServiceFixed' } },
                },
            });

            const result = await handler.execute(command);

            expect(result.id).toEqual(expect.any(String));
        });
    });

    // design.md change salary-rule-bitrix-task, Decision 4: "сначала
    // Bitrix, потом БД" с компенсацией при ошибке БД.
    describe('правило TaskCompleted (design.md, Decision 4)', () => {
        const buildCommand = (responsibleId: number | null = 42) =>
            new CreateSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                responsibleId,
                rule: {
                    type: 'TaskCompleted',
                    name: 'Сдать отчёт',
                    targetRole: 'ENGINEER',
                    config: {
                        description: 'Описание',
                        period: '2026-08',
                        isRecurring: false,
                        dueDate: '2026-08-20',
                        rewardAmount: 5000,
                    },
                },
            });

        it('happy path: сначала создаёт задачу в Bitrix24, затем сохраняет правило с её ID', async () => {
            await withRequestContext(async () => {
                const { handler, insert, createTask, deleteTask } =
                    buildHandler({ createTaskId: 3711 });

                await handler.execute(buildCommand(42));

                expect(createTask).toHaveBeenCalledTimes(1);
                expect(createTask).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Сдать отчёт',
                        description: 'Описание',
                        responsibleId: 42,
                        period: '2026-08',
                    }),
                );
                expect(insert).toHaveBeenCalledTimes(1);
                const [entity] = insert.mock.calls[0];
                expect(entity).toBeInstanceOf(TaskCompletedEntity);
                expect((entity as TaskCompletedEntity).bitrixTaskIds).toEqual([
                    3711,
                ]);
                expect(deleteTask).not.toHaveBeenCalled();
            });
        });

        it('без ответственного (схема на отдел) отклоняет создание, не обращаясь в Bitrix24', async () => {
            await withRequestContext(async () => {
                const { handler, createTask, insert } = buildHandler();

                await expect(
                    handler.execute(buildCommand(null)),
                ).rejects.toThrow(TaskRuleRequiresEmployeeTargetException);

                expect(createTask).not.toHaveBeenCalled();
                expect(insert).not.toHaveBeenCalled();
            });
        });

        it('ошибка сохранения правила в БД компенсируется удалением уже созданной задачи Bitrix24', async () => {
            await withRequestContext(async () => {
                const dbError = new Error('db down');
                const { handler, deleteTask } = buildHandler({
                    createTaskId: 3711,
                    insertImpl: () => Promise.reject(dbError),
                });

                await expect(handler.execute(buildCommand(42))).rejects.toThrow(
                    dbError,
                );

                expect(deleteTask).toHaveBeenCalledTimes(1);
                expect(deleteTask).toHaveBeenCalledWith(3711);
            });
        });

        it('если компенсирующее удаление тоже падает — исходная ошибка сохранения всё равно пробрасывается', async () => {
            await withRequestContext(async () => {
                const dbError = new Error('db down');
                const { handler, deleteTask } = buildHandler({
                    createTaskId: 3711,
                    insertImpl: () => Promise.reject(dbError),
                });
                (deleteTask as jest.Mock).mockRejectedValueOnce(
                    new Error('bitrix unreachable'),
                );

                await expect(handler.execute(buildCommand(42))).rejects.toThrow(
                    dbError,
                );
            });
        });
    });
});
