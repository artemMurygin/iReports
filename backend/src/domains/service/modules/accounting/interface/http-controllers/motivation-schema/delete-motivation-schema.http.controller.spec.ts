import { CommandBus } from '@nestjs/cqrs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { DeleteMotivationSchemaHttpController } from './delete-motivation-schema.http.controller';
import { DeleteMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/delete-motivation-schema.command';

// FR1 delete-motivation-schema.
describe('DeleteMotivationSchemaHttpController', () => {
    it('оборачивает :id в DeleteMotivationSchemaCommand и передаёт его в CommandBus', async () => {
        await withRequestContext(async () => {
            const execute = jest
                .fn<Promise<unknown>, [DeleteMotivationSchemaCommand]>()
                .mockResolvedValue(undefined);
            const commandBus = { execute } as unknown as CommandBus;
            const controller = new DeleteMotivationSchemaHttpController(
                commandBus,
            );

            const result = await controller.delete('schema-1');

            expect(execute).toHaveBeenCalledTimes(1);
            const [command] = execute.mock.calls[0];
            expect(command).toBeInstanceOf(DeleteMotivationSchemaCommand);
            expect(command.schemaId).toBe('schema-1');
            expect(result).toBeUndefined();
        });
    });
});
