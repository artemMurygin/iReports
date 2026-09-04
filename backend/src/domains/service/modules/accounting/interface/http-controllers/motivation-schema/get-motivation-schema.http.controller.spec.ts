import { withRequestContext } from '@/shared/testing/with-request-context';
import { GetMotivationSchemaHttpController } from './get-motivation-schema.http.controller';
import { GetMotivationSchemaService } from '@/domains/service/modules/accounting/application/services/motivation-schema/get-motivation-schema.service';

describe('GetMotivationSchemaHttpController', () => {
    it('передаёт :id из параметров маршрута в GetMotivationSchemaService.execute', async () => {
        await withRequestContext(async () => {
            const execute = jest.fn().mockResolvedValue({ id: 'schema-1' });
            const service = {
                execute,
            } as unknown as GetMotivationSchemaService;
            const controller = new GetMotivationSchemaHttpController(service);

            const result = await controller.get('schema-1');

            expect(execute).toHaveBeenCalledTimes(1);
            expect(execute).toHaveBeenCalledWith('schema-1');
            expect(result).toEqual({ id: 'schema-1' });
        });
    });
});
