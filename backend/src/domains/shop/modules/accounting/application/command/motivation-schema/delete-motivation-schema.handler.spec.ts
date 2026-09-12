import { withRequestContext } from '@/shared/testing/with-request-context';
import { NotFoundException } from '@/shared/exceptions';
import { DeleteShopMotivationSchemaHandler } from './delete-motivation-schema.handler';
import { DeleteShopMotivationSchemaCommand } from './delete-motivation-schema.command';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { ShopSalaryRuleFactory } from '@/domains/shop/modules/accounting/domain/factories/salary-rule.factory';

// Зеркало domains/service/modules/accounting/application/command/
// motivation-schema/delete-motivation-schema.handler.spec.ts. FR2 delete-motivation-schema.
describe('DeleteShopMotivationSchemaHandler', () => {
    const buildSchema = (ruleCount: number) => {
        const rules = Array.from({ length: ruleCount }, (_, index) =>
            ShopSalaryRuleFactory.create({
                type: 'PayPerHour',
                name: `Часы ${index}`,
                targetRole: 'ONLINE_MANAGER',
                config: { price: 100 },
            }),
        );

        return ShopMotivationSchema.create({
            targetType: 'Employee',
            targetId: 42,
            name: 'Оклад',
            rules,
        });
    };

    const buildHandler = (schema: ShopMotivationSchema | null) => {
        const deleteDirectionSchema = jest.fn().mockResolvedValue(undefined);
        const findById = jest
            .fn<Promise<ShopMotivationSchema | null>, [string]>()
            .mockResolvedValue(schema);
        const repo: Partial<ShopMotivationSchemaRepositoryPort> = {
            findById,
            deleteDirectionSchema,
        };
        const handler = new DeleteShopMotivationSchemaHandler(
            repo as ShopMotivationSchemaRepositoryPort,
        );
        return { handler, deleteDirectionSchema, findById };
    };

    it('падает NotFoundException, если схема не найдена', async () => {
        await withRequestContext(async () => {
            const { handler, deleteDirectionSchema } = buildHandler(null);

            await expect(
                handler.execute(
                    new DeleteShopMotivationSchemaCommand({
                        schemaId: 'missing',
                    }),
                ),
            ).rejects.toBeInstanceOf(NotFoundException);
            expect(deleteDirectionSchema).not.toHaveBeenCalled();
        });
    });

    it('падает NotFoundException, если у схемы 0 правил направления shop', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema(0);
            const { handler, deleteDirectionSchema } = buildHandler(schema);

            await expect(
                handler.execute(
                    new DeleteShopMotivationSchemaCommand({
                        schemaId: schema.id,
                    }),
                ),
            ).rejects.toBeInstanceOf(NotFoundException);
            expect(deleteDirectionSchema).not.toHaveBeenCalled();
        });
    });

    it('удаляет схему направления shop через репозиторий, если правила есть', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema(1);
            const { handler, deleteDirectionSchema } = buildHandler(schema);

            await handler.execute(
                new DeleteShopMotivationSchemaCommand({ schemaId: schema.id }),
            );

            expect(deleteDirectionSchema).toHaveBeenCalledTimes(1);
            expect(deleteDirectionSchema).toHaveBeenCalledWith(schema.id);
        });
    });
});
