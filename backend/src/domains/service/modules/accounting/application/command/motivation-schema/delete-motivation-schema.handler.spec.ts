import { withRequestContext } from '@/shared/testing/with-request-context';
import { NotFoundException } from '@/shared/exceptions';
import { DeleteMotivationSchemaHandler } from './delete-motivation-schema.handler';
import { DeleteMotivationSchemaCommand } from './delete-motivation-schema.command';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';

// FR1: удаление мотивационной схемы направления service.
describe('DeleteMotivationSchemaHandler', () => {
    const buildSchema = (ruleCount: number) => {
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
            targetId: 42,
            name: 'Оклад',
            rules,
        });
    };

    const buildHandler = (schema: MotivationSchema | null) => {
        const deleteDirectionSchema = jest.fn().mockResolvedValue(undefined);
        const findById = jest
            .fn<Promise<MotivationSchema | null>, [string]>()
            .mockResolvedValue(schema);
        const repo: MotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn().mockResolvedValue(null),
            findById,
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn(),
            initializeName: jest.fn(),
            deleteDirectionSchema,
        };
        const handler = new DeleteMotivationSchemaHandler(repo);
        return { handler, deleteDirectionSchema, findById };
    };

    it('падает NotFoundException, если схема не найдена', async () => {
        await withRequestContext(async () => {
            const { handler, deleteDirectionSchema } = buildHandler(null);

            await expect(
                handler.execute(
                    new DeleteMotivationSchemaCommand({ schemaId: 'missing' }),
                ),
            ).rejects.toBeInstanceOf(NotFoundException);
            expect(deleteDirectionSchema).not.toHaveBeenCalled();
        });
    });

    it('падает NotFoundException, если у схемы 0 правил направления service', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema(0);
            const { handler, deleteDirectionSchema } = buildHandler(schema);

            await expect(
                handler.execute(
                    new DeleteMotivationSchemaCommand({ schemaId: schema.id }),
                ),
            ).rejects.toBeInstanceOf(NotFoundException);
            expect(deleteDirectionSchema).not.toHaveBeenCalled();
        });
    });

    it('удаляет схему направления service через репозиторий, если правила есть', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema(1);
            const { handler, deleteDirectionSchema } = buildHandler(schema);

            await handler.execute(
                new DeleteMotivationSchemaCommand({ schemaId: schema.id }),
            );

            expect(deleteDirectionSchema).toHaveBeenCalledTimes(1);
            expect(deleteDirectionSchema).toHaveBeenCalledWith(schema.id);
        });
    });
});
