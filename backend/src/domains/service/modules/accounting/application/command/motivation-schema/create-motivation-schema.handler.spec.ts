import { CommandBus } from '@nestjs/cqrs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateMotivationSchemaHandler } from './create-motivation-schema.handler';
import { CreateMotivationSchemaCommand } from './create-motivation-schema.command';
import { CreateSalaryRuleCommand } from './create-salary-rule.command';
import type { MotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';

describe('CreateMotivationSchemaHandler', () => {
    const buildHandler = (existingId: string | null = null) => {
        const insert = jest
            .fn<Promise<void>, [MotivationSchema]>()
            .mockResolvedValue(undefined);
        const findIdByTarget = jest
            .fn<Promise<string | null>, [string, number]>()
            .mockResolvedValue(existingId);
        const initializeName = jest
            .fn<Promise<void>, [string, string]>()
            .mockResolvedValue(undefined);
        const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
            insert,
            findIdByTarget,
            findByEmployee: jest.fn().mockResolvedValue(null),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findById: jest.fn().mockResolvedValue(null),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue(undefined),
            initializeName,
        };
        // run() выполняет переданную работу напрямую, без реальной транзакции —
        // для юнит-теста хендлера этого достаточно, транзакционность самого
        // UnitOfWork проверяется отдельно на уровне его реализации.
        const run = jest.fn((work: () => Promise<unknown>) => work());
        const unitOfWork: UnitOfWorkPort = {
            run: run as UnitOfWorkPort['run'],
        };
        const execute = jest
            .fn<Promise<unknown>, [CreateSalaryRuleCommand]>()
            .mockResolvedValue({ id: 'rule-id' });
        const commandBus = { execute } as unknown as CommandBus;

        const handler = new CreateMotivationSchemaHandler(
            motivationSchemaRepo,
            unitOfWork,
            commandBus,
        );

        return {
            handler,
            insert,
            findIdByTarget,
            run,
            execute,
            initializeName,
        };
    };

    it('оборачивает запись схемы и правил в unitOfWork.run', async () => {
        await withRequestContext(async () => {
            const { handler, run } = buildHandler();
            const command = new CreateMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 1,
                name: 'Оклад',
                rules: [],
            });

            await handler.execute(command);

            expect(run).toHaveBeenCalledTimes(1);
        });
    });

    it('сохраняет созданную MotivationSchema через репозиторий', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler();
            const command = new CreateMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 1,
                name: 'Оклад',
                rules: [],
            });

            await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(1);
            const [insertedEntity] = insert.mock.calls[0];
            expect(insertedEntity).toBeInstanceOf(MotivationSchema);
            const insertedProps = insertedEntity.getProps();
            expect(insertedProps.target.getType()).toBe('Employee');
            expect(insertedProps.target.getId()).toBe(1);
            expect(insertedProps.name).toBe('Оклад');
        });
    });

    it('диспатчит CreateSalaryRuleCommand для каждого правила с id созданной схемы', async () => {
        await withRequestContext(async () => {
            const { handler, execute } = buildHandler();
            const command = new CreateMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 1,
                name: 'Оклад',
                rules: [
                    {
                        type: 'PayPerHour',
                        name: 'Часы',
                        targetRole: 'ENGINEER',
                        config: { price: 100 },
                    },
                    {
                        type: 'ServiceCompleted',
                        name: 'Услуги',
                        targetRole: 'ENGINEER',
                        config: { award: { type: 'ServiceFixed' } },
                    },
                ],
            });

            const result = await handler.execute(command);

            expect(execute).toHaveBeenCalledTimes(2);
            for (const [dispatched] of execute.mock.calls) {
                expect(dispatched).toBeInstanceOf(CreateSalaryRuleCommand);
                expect(dispatched.motivationSchemaId).toBe(result.id);
            }
            expect(execute.mock.calls[0][0].rule).toEqual(command.rules[0]);
        });
    });

    it('возвращает id созданной схемы', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler();
            const command = new CreateMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 1,
                name: 'Оклад',
                rules: [],
            });

            const result = await handler.execute(command);

            expect(result.id).toEqual(expect.any(String));
        });
    });

    it('если findIdByTarget нашёл существующую схему — не вставляет новую, а дописывает правила к найденному id', async () => {
        await withRequestContext(async () => {
            const { handler, insert, execute } =
                buildHandler('existing-schema-id');
            const command = new CreateMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 1,
                name: 'Оклад',
                rules: [
                    {
                        type: 'PayPerHour',
                        name: 'Часы',
                        targetRole: 'ENGINEER',
                        config: { price: 100 },
                    },
                    {
                        type: 'ServiceCompleted',
                        name: 'Услуги',
                        targetRole: 'ENGINEER',
                        config: { award: { type: 'ServiceFixed' } },
                    },
                ],
            });

            const result = await handler.execute(command);

            expect(insert).not.toHaveBeenCalled();
            expect(result.id).toBe('existing-schema-id');
            expect(execute).toHaveBeenCalledTimes(2);
            for (const [dispatched] of execute.mock.calls) {
                expect(dispatched).toBeInstanceOf(CreateSalaryRuleCommand);
                expect(dispatched.motivationSchemaId).toBe(
                    'existing-schema-id',
                );
            }
        });
    });

    it('регрессия на кросс-направленческий баг переименования: если схема найдена по findIdByTarget (уже создана со стороны shop), инициализирует serviceName через initializeName, а не insert', async () => {
        await withRequestContext(async () => {
            const { handler, insert, initializeName } =
                buildHandler('existing-schema-id');
            const command = new CreateMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 1,
                name: 'QA_SERVICE_ORIGINAL',
                rules: [],
            });

            await handler.execute(command);

            expect(insert).not.toHaveBeenCalled();
            expect(initializeName).toHaveBeenCalledTimes(1);
            expect(initializeName).toHaveBeenCalledWith(
                'existing-schema-id',
                'QA_SERVICE_ORIGINAL',
            );
        });
    });

    it('не вызывает initializeName, когда создаётся новая строка (insert уже сам сохраняет serviceName)', async () => {
        await withRequestContext(async () => {
            const { handler, initializeName } = buildHandler(null);
            const command = new CreateMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 1,
                name: 'Оклад',
                rules: [],
            });

            await handler.execute(command);

            expect(initializeName).not.toHaveBeenCalled();
        });
    });

    it('вызывает findIdByTarget с targetType/targetId команды', async () => {
        await withRequestContext(async () => {
            const { handler, findIdByTarget } = buildHandler();
            const command = new CreateMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 42,
                name: 'Оклад',
                rules: [],
            });

            await handler.execute(command);

            expect(findIdByTarget).toHaveBeenCalledWith('Employee', 42);
        });
    });
});
