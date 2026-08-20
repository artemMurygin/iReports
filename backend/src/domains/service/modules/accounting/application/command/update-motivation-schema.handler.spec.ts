import { CommandBus } from '@nestjs/cqrs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { UpdateMotivationSchemaHandler } from './update-motivation-schema.handler';
import { UpdateMotivationSchemaCommand } from './update-motivation-schema.command';
import { CreateSalaryRuleCommand } from './create-salary-rule.command';
import { NotFoundException } from '@/shared/exceptions';
import type { MotivationSchemaRepositoryPort } from '../ports/motivation-schema.port';
import type { SalaryRuleRepositoryPort } from '../ports/salary-rule.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';

describe('UpdateMotivationSchemaHandler', () => {
    const buildExistingSchema = (ruleCount = 1) => {
        const rules = Array.from({ length: ruleCount }, (_, index) =>
            PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: `Часы ${index}`,
                targetRole: 'ENGINEER',
                config: { price: 100 },
            }),
        );

        return MotivationSchema.create({
            targetType: 'Employee',
            targetId: 1,
            name: 'Старое имя',
            rules,
        });
    };

    const buildHandler = (existingSchema: MotivationSchema | null) => {
        const findById = jest
            .fn<Promise<MotivationSchema | null>, [string]>()
            .mockResolvedValue(existingSchema);
        const update = jest
            .fn<Promise<void>, [MotivationSchema]>()
            .mockResolvedValue(undefined);
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
            update,
            initializeName: jest.fn().mockResolvedValue(undefined),
        };
        const deleteAllByMotivationSchema = jest
            .fn<Promise<void>, [string]>()
            .mockResolvedValue(undefined);
        const salaryRuleRepo: SalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteAllByMotivationSchema,
        };
        // run() выполняет переданную работу напрямую, без реальной транзакции
        // — тот же приём, что и в create-motivation-schema.handler.spec.ts.
        const run = jest.fn((work: () => Promise<unknown>) => work());
        const unitOfWork: UnitOfWorkPort = {
            run: run as UnitOfWorkPort['run'],
        };
        const execute = jest
            .fn<Promise<unknown>, [CreateSalaryRuleCommand]>()
            .mockResolvedValue({ id: 'rule-id' });
        const commandBus = { execute } as unknown as CommandBus;

        const handler = new UpdateMotivationSchemaHandler(
            motivationSchemaRepo,
            salaryRuleRepo,
            unitOfWork,
            commandBus,
        );

        return {
            handler,
            findById,
            update,
            deleteAllByMotivationSchema,
            run,
            execute,
        };
    };

    it('оборачивает переименование и замену правил в unitOfWork.run', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const { handler, run } = buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [],
            });

            await handler.execute(command);

            expect(run).toHaveBeenCalledTimes(1);
        });
    });

    it('переименовывает найденную схему и персистит имя через update', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const { handler, update } = buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [],
            });

            await handler.execute(command);

            expect(existingSchema.getProps().name).toBe('Новое имя');
            expect(update).toHaveBeenCalledTimes(1);
            expect(update.mock.calls[0][0]).toBe(existingSchema);
        });
    });

    it('удаляет все существующие правила направления service перед пересозданием', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const { handler, deleteAllByMotivationSchema } =
                buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [],
            });

            await handler.execute(command);

            expect(deleteAllByMotivationSchema).toHaveBeenCalledTimes(1);
            expect(deleteAllByMotivationSchema).toHaveBeenCalledWith(
                existingSchema.id,
            );
        });
    });

    it('диспатчит CreateSalaryRuleCommand для каждого правила из payload с id схемы', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const { handler, execute } = buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [
                    {
                        type: 'PayPerHour',
                        name: 'Часы',
                        targetRole: 'ENGINEER',
                        config: { price: 150 },
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
            expect(execute.mock.calls[1][0].rule).toEqual(command.rules[1]);
        });
    });

    it('возвращает id обновлённой схемы', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const { handler } = buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [],
            });

            const result = await handler.execute(command);

            expect(result.id).toBe(existingSchema.id);
        });
    });

    it('выбрасывает NotFoundException, если схема не найдена', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler(null);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: 'missing-id',
                name: 'Новое имя',
                rules: [],
            });

            await expect(handler.execute(command)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    it('выбрасывает NotFoundException, если у схемы 0 правил направления service (все правила — shop-стороны)', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema(0);
            const { handler, update, deleteAllByMotivationSchema } =
                buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [],
            });

            await expect(handler.execute(command)).rejects.toThrow(
                NotFoundException,
            );
            expect(update).not.toHaveBeenCalled();
            expect(deleteAllByMotivationSchema).not.toHaveBeenCalled();
        });
    });
});
