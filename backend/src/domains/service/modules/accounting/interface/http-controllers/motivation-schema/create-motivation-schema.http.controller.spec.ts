import { CommandBus } from '@nestjs/cqrs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateMotivationSchemaHttpController } from './create-motivation-schema.http.controller';
import { CreateMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/create-motivation-schema.command';
import { MotivationSchemaCreateDto } from '../dto/motivation-schema-create.dto';

describe('CreateMotivationSchemaHttpController', () => {
    it('оборачивает тело запроса в CreateMotivationSchemaCommand и передаёт его в CommandBus', async () => {
        await withRequestContext(async () => {
            const execute = jest
                .fn<Promise<unknown>, [CreateMotivationSchemaCommand]>()
                .mockResolvedValue({ id: 'schema-1' });
            const commandBus = { execute } as unknown as CommandBus;
            const controller = new CreateMotivationSchemaHttpController(
                commandBus,
            );
            const body: MotivationSchemaCreateDto = {
                targetType: 'Employee',
                targetId: 7,
                name: 'Оклад',
                rules: [],
            };

            const result = await controller.create(body);

            expect(execute).toHaveBeenCalledTimes(1);
            const [command] = execute.mock.calls[0];
            expect(command).toBeInstanceOf(CreateMotivationSchemaCommand);
            expect(command).toMatchObject(body);
            expect(result).toEqual({ id: 'schema-1' });
        });
    });
});
