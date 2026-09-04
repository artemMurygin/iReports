import { CommandBus } from '@nestjs/cqrs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { UpdateMotivationSchemaHttpController } from './update-motivation-schema.http.controller';
import { UpdateMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/update-motivation-schema.command';
import type { UpdateMotivationSchemaDto } from '../../dto/motivation-schema/update-motivation-schema.dto';

describe('UpdateMotivationSchemaHttpController', () => {
    it('оборачивает :id и тело запроса в UpdateMotivationSchemaCommand и передаёт его в CommandBus', async () => {
        await withRequestContext(async () => {
            const execute = jest
                .fn<Promise<unknown>, [UpdateMotivationSchemaCommand]>()
                .mockResolvedValue({ id: 'schema-1' });
            const commandBus = { execute } as unknown as CommandBus;
            const controller = new UpdateMotivationSchemaHttpController(
                commandBus,
            );
            const body: UpdateMotivationSchemaDto = {
                name: 'Новое имя',
                rules: [],
            };

            const result = await controller.update('schema-1', body);

            expect(execute).toHaveBeenCalledTimes(1);
            const [command] = execute.mock.calls[0];
            expect(command).toBeInstanceOf(UpdateMotivationSchemaCommand);
            expect(command.motivationSchemaId).toBe('schema-1');
            expect(command.name).toBe('Новое имя');
            expect(command.rules).toEqual([]);
            expect(result).toEqual({ id: 'schema-1' });
        });
    });
});
