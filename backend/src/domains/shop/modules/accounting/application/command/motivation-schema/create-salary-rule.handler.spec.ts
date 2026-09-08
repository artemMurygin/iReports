import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateShopSalaryRuleHandler } from './create-salary-rule.handler';
import { CreateShopSalaryRuleCommand } from './create-salary-rule.command';
import type { ShopSalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import type { ShopMotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import type { BitrixTasksGatewayPort } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import type { ShopSalaryTaskRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-task/salary-task.port';
import { TaskCompletionRequiresPersonalSchemaException } from '@/domains/shop/modules/accounting/domain/exceptions/motivation-schema.exception';

// Раздел 17 tasks.md (add-task-based-salary-rule), design.md Decision 6 —
// зеркало CreateSalaryRuleHandler направления service (раздел 12, issue
// #57 — независимая копия): правило TaskCompletion создаёт задачу в
// Bitrix24 ДО записи в БД, персистит ShopSalaryRule+ShopSalaryTask в одной
// транзакции, компенсирует (закрывает только что созданную задачу) при
// сбое записи в БД. Остальные типы правил (PayPerHour/ProductSold/
// UsedProductSold) не затронуты — см. описание существующих тестов ниже.
describe('CreateShopSalaryRuleHandler', () => {
    const buildHandler = (overrides?: {
        insertImpl?: () => Promise<void>;
        salaryTaskInsertImpl?: () => Promise<void>;
        schema?: ShopMotivationSchema | null;
        createTaskImpl?: () => Promise<{ bitrixTaskId: string }>;
        unitOfWorkRun?: <T>(work: () => Promise<T>) => Promise<T>;
    }) => {
        const insert = jest
            .fn<
                Promise<void>,
                [ShopSalaryRule, { motivationSchemaId: string }]
            >()
            .mockImplementation(
                overrides?.insertImpl ?? (() => Promise.resolve()),
            );
        const shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort = {
            insert,
            deleteByIds: jest.fn().mockResolvedValue(undefined),
            // Раздел 16 tasks.md (add-task-based-salary-rule) — метод, не
            // используемый CreateShopSalaryRuleHandler, но обязательный по
            // интерфейсу порта (EnsureShopSalaryTaskForPeriodService).
            findById: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue(undefined),
        };

        const findById = jest
            .fn<Promise<ShopMotivationSchema | null>, [string]>()
            .mockResolvedValue(overrides?.schema ?? null);
        const shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findIdByTarget: jest.fn().mockResolvedValue(null),
            findById,
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue(undefined),
        } as unknown as ShopMotivationSchemaRepositoryPort;

        const run = jest.fn(
            (overrides?.unitOfWorkRun as UnitOfWorkPort['run']) ??
                ((work: () => Promise<unknown>) => work()),
        );
        const unitOfWork: UnitOfWorkPort = { run };

        const createTask = jest
            .fn()
            .mockImplementation(
                overrides?.createTaskImpl ??
                    (() => Promise.resolve({ bitrixTaskId: 'bx-1' })),
            );
        const closeTask = jest.fn().mockResolvedValue(undefined);
        const tasksGateway: BitrixTasksGatewayPort = {
            createTask,
            closeTask,
            updateDeadline: jest.fn(),
        };

        const salaryTaskInsert = jest
            .fn()
            .mockImplementation(
                overrides?.salaryTaskInsertImpl ?? (() => Promise.resolve()),
            );
        const salaryTaskRepo: ShopSalaryTaskRepositoryPort = {
            findByRuleAndPeriod: jest.fn(),
            findActiveForDirection: jest.fn(),
            insert: salaryTaskInsert,
            save: jest.fn(),
            findManyByRulesAndPeriod: jest.fn().mockResolvedValue([]),
            findActiveByRule: jest.fn().mockResolvedValue([]),
        };

        const handler = new CreateShopSalaryRuleHandler(
            shopSalaryRuleRepo,
            shopMotivationSchemaRepo,
            unitOfWork,
            tasksGateway,
            salaryTaskRepo,
        );
        return {
            handler,
            insert,
            findById,
            run,
            createTask,
            closeTask,
            salaryTaskInsert,
        };
    };

    it('создаёт правило нужного типа через ShopSalaryRuleFactory и сохраняет его', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler();
            const command = new CreateShopSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                rule: {
                    type: 'PayPerHour',
                    name: 'Часы',
                    targetRole: 'OFFLINE_MANAGER',
                    config: { price: 200 },
                },
            });

            await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(1);
            const [entity, meta] = insert.mock.calls[0];
            expect(entity).toBeInstanceOf(PayPerHourShopEntity);
            expect(
                entity.calculate({
                    employee: { id: 1, identities: [] },
                    period: {
                        direction: 'shop',
                        period: '2026-08',
                        from: new Date('2026-08-01T00:00:00.000Z'),
                        to: new Date('2026-08-31T23:59:59.999Z'),
                        status: 'OPEN',
                    },
                    mode: 'FACT',
                    erpData: { hoursWorked: { fact: 5, prognose: 5 } },
                    salesPerformance: null,
                }).amount,
            ).toBe(1000);
            expect(meta).toEqual({ motivationSchemaId: 'schema-1' });
        });
    });

    it('возвращает id созданного правила', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler();
            const command = new CreateShopSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                rule: {
                    type: 'ProductSold',
                    name: 'Продажи',
                    targetRole: 'OFFLINE_MANAGER',
                    config: {
                        category: null,
                        award: { type: 'Fixed', price: 100 },
                    },
                },
            });

            const result = await handler.execute(command);

            expect(result.id).toEqual(expect.any(String));
        });
    });

    describe('правило TaskCompletion', () => {
        const buildCommand = () =>
            new CreateShopSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                rule: {
                    type: 'TaskCompletion',
                    name: 'Сдать отчёт',
                    targetRole: 'OFFLINE_MANAGER',
                    config: {
                        bitrixTaskTitle: 'Сдать отчёт по браку',
                        isRecurring: false,
                        deadlineTemplate: '2026-09-20T00:00:00.000Z',
                        defaultAmount: 5000,
                    },
                },
            });

        it('создаёт задачу в Bitrix24 (ответственный — сотрудник личной схемы) ДО записи правила и задачи в БД', async () => {
            await withRequestContext(async () => {
                const schema = ShopMotivationSchema.create({
                    targetType: 'Employee',
                    targetId: 555,
                    name: 'Личная схема',
                    rules: [],
                });
                const calls: string[] = [];
                const { handler, insert, createTask, salaryTaskInsert } =
                    buildHandler({
                        schema,
                        insertImpl: () => {
                            calls.push('insertRule');
                            return Promise.resolve();
                        },
                        salaryTaskInsertImpl: () => {
                            calls.push('insertTask');
                            return Promise.resolve();
                        },
                        createTaskImpl: () => {
                            calls.push('createTask');
                            return Promise.resolve({ bitrixTaskId: 'bx-42' });
                        },
                    });

                await handler.execute(buildCommand());

                expect(createTask).toHaveBeenCalledWith(
                    expect.objectContaining({
                        responsibleBitrixUserId: 555,
                        title: 'Сдать отчёт по браку',
                    }),
                );
                expect(calls).toEqual([
                    'createTask',
                    'insertRule',
                    'insertTask',
                ]);
                expect(insert).toHaveBeenCalledTimes(1);
                expect(salaryTaskInsert).toHaveBeenCalledTimes(1);
                const [task] = salaryTaskInsert.mock.calls[0] as [
                    { bitrixTaskId: string },
                ];
                expect(task.bitrixTaskId).toBe('bx-42');
            });
        });

        it('ошибка Bitrix24 при создании задачи — правило НЕ создаётся', async () => {
            await withRequestContext(async () => {
                const schema = ShopMotivationSchema.create({
                    targetType: 'Employee',
                    targetId: 555,
                    name: 'Личная схема',
                    rules: [],
                });
                const { handler, insert, run } = buildHandler({
                    schema,
                    createTaskImpl: () =>
                        Promise.reject(new Error('bitrix insert down')),
                });

                await expect(handler.execute(buildCommand())).rejects.toThrow(
                    'bitrix insert down',
                );

                expect(insert).not.toHaveBeenCalled();
                expect(run).not.toHaveBeenCalled();
            });
        });

        it('запись в БД падает после успешного создания в Bitrix24 — компенсирующий closeTask закрывает задачу, исходная ошибка пробрасывается', async () => {
            await withRequestContext(async () => {
                const schema = ShopMotivationSchema.create({
                    targetType: 'Employee',
                    targetId: 555,
                    name: 'Личная схема',
                    rules: [],
                });
                const dbError = new Error('db insert failed');
                const { handler, closeTask } = buildHandler({
                    schema,
                    createTaskImpl: () =>
                        Promise.resolve({ bitrixTaskId: 'bx-77' }),
                    salaryTaskInsertImpl: () => Promise.reject(dbError),
                });

                await expect(handler.execute(buildCommand())).rejects.toBe(
                    dbError,
                );

                expect(closeTask).toHaveBeenCalledWith('bx-77');
            });
        });

        it('схема на ОТДЕЛ — правило TaskCompletion отклоняется, задача Bitrix24 не создаётся, БД не трогается', async () => {
            await withRequestContext(async () => {
                const schema = ShopMotivationSchema.create({
                    targetType: 'Department',
                    targetId: 10,
                    name: 'Схема отдела',
                    rules: [],
                });
                const { handler, createTask, insert, run } = buildHandler({
                    schema,
                });

                await expect(handler.execute(buildCommand())).rejects.toThrow(
                    TaskCompletionRequiresPersonalSchemaException,
                );
                expect(createTask).not.toHaveBeenCalled();
                expect(insert).not.toHaveBeenCalled();
                expect(run).not.toHaveBeenCalled();
            });
        });
    });
});
