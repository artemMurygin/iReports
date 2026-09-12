import { CommandBus } from '@nestjs/cqrs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { DeleteShopMotivationSchemaHttpController } from './delete-motivation-schema.http.controller';
import { DeleteShopMotivationSchemaCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/delete-motivation-schema.command';

// Зеркало domains/service/modules/accounting/interface/http-controllers/
// motivation-schema/delete-motivation-schema.http.controller.spec.ts. FR2
// delete-motivation-schema.
describe('DeleteShopMotivationSchemaHttpController', () => {
    it('оборачивает :id в DeleteShopMotivationSchemaCommand и передаёт его в CommandBus', async () => {
        await withRequestContext(async () => {
            const execute = jest
                .fn<Promise<unknown>, [DeleteShopMotivationSchemaCommand]>()
                .mockResolvedValue(undefined);
            const commandBus = { execute } as unknown as CommandBus;
            const controller = new DeleteShopMotivationSchemaHttpController(
                commandBus,
            );

            const result = await controller.delete('schema-1');

            expect(execute).toHaveBeenCalledTimes(1);
            const [command] = execute.mock.calls[0];
            expect(command).toBeInstanceOf(DeleteShopMotivationSchemaCommand);
            expect(command.schemaId).toBe('schema-1');
            expect(result).toBeUndefined();
        });
    });
});
