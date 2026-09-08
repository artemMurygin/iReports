import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateSalaryRuleHandler } from './create-salary-rule.handler';
import { CreateSalaryRuleCommand } from './create-salary-rule.command';
import type { SalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import type { MotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { TaskCompletionRequiresPersonalSchemaException } from '@/domains/service/modules/accounting/domain/exceptions/motivation-schema.exception';
import { Period } from '@/shared/domain/period.value-object';

// replace-bitrix-task-integration, design.md решение 4 — CreateSalaryRuleHandler
// БОЛЬШЕ НЕ вызывает ни tasks (CommandBus), ни какую-либо внешнюю систему
// при создании правила TaskCompletion: taskId уже существующей задачи
// приходит в теле запроса как часть config и просто сохраняется в
// config.taskIdByPeriod[текущийПериод] (TaskCompletion.create()) как часть
// ОДНОГО, уже существующего локального insert(rule) — без транзакции, без
// UNIT_OF_WORK, без компенсации. Остальные типы правил (PayPerHour/
// ServiceCompleted/OrderPayed) не затронуты.
describe('CreateSalaryRuleHandler', () => {
    const buildHandler = (overrides?: {
        insertImpl?: () => Promise<void>;
        schema?: MotivationSchema | null;
    }) => {
        const insert = jest
            .fn<Promise<void>, [SalaryRule, { motivationSchemaId: string }]>()
            .mockImplementation(
                overrides?.insertImpl ?? (() => Promise.resolve()),
            );
        const salaryRuleRepo: SalaryRuleRepositoryPort = {
            insert,
            deleteByIds: jest.fn().mockResolvedValue(undefined),
            findById: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue(undefined),
        };

        const findById = jest
            .fn<Promise<MotivationSchema | null>, [string]>()
            .mockResolvedValue(overrides?.schema ?? null);
        const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn().mockResolvedValue(null),
            findById,
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue(undefined),
            initializeName: jest.fn().mockResolvedValue(undefined),
        };

        const handler = new CreateSalaryRuleHandler(
            salaryRuleRepo,
            motivationSchemaRepo,
        );
        return { handler, insert, findById };
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
            const line = await entity.calculate({
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
            });
            expect(line?.amount).toBe(1000);
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

    describe('правило TaskCompletion', () => {
        const buildCommand = () =>
            new CreateSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                rule: {
                    type: 'TaskCompletion',
                    name: 'Сдать отчёт',
                    targetRole: 'ENGINEER',
                    config: {
                        taskId: 'task-42',
                        taskTitleTemplate: 'Сдать отчёт по браку',
                        isRecurring: false,
                        deadlineTemplate: '2026-09-20T00:00:00.000Z',
                        defaultAmount: 5000,
                    },
                },
            });

        it('сохраняет правило локально, без обращения в tasks — taskId уходит в config.taskIdByPeriod текущего периода', async () => {
            await withRequestContext(async () => {
                const schema = MotivationSchema.create({
                    targetType: 'Employee',
                    targetId: 555,
                    name: 'Личная схема',
                    rules: [],
                });
                const { handler, insert } = buildHandler({ schema });

                const result = await handler.execute(buildCommand());

                expect(insert).toHaveBeenCalledTimes(1);
                const [entity] = insert.mock.calls[0];
                expect(entity.config).toMatchObject({
                    taskIdByPeriod: {
                        [Period.current().getValue()]: 'task-42',
                    },
                });
                expect(result.id).toBe(entity.id);
            });
        });

        it('схема на ОТДЕЛ — правило TaskCompletion отклоняется, правило не сохраняется', async () => {
            await withRequestContext(async () => {
                const schema = MotivationSchema.create({
                    targetType: 'Department',
                    targetId: 10,
                    name: 'Схема отдела',
                    rules: [],
                });
                const { handler, insert } = buildHandler({ schema });

                await expect(handler.execute(buildCommand())).rejects.toThrow(
                    TaskCompletionRequiresPersonalSchemaException,
                );
                expect(insert).not.toHaveBeenCalled();
            });
        });

        it('мотивационная схема не найдена — NotFoundException, правило не сохраняется', async () => {
            await withRequestContext(async () => {
                const { handler, insert } = buildHandler({ schema: null });

                await expect(handler.execute(buildCommand())).rejects.toThrow(
                    'Мотивационная схема не найдена',
                );
                expect(insert).not.toHaveBeenCalled();
            });
        });
    });
});
