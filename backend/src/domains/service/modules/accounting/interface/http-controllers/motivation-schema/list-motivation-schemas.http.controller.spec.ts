import { withRequestContext } from '@/shared/testing/with-request-context';
import { ListMotivationSchemasHttpController } from './list-motivation-schemas.http.controller';
import { ListMotivationSchemasService } from '@/domains/service/modules/accounting/application/services/motivation-schema/list-motivation-schemas.service';
import type { ListMotivationSchemasQueryDto } from '../../dto/motivation-schema/list-motivation-schemas-query.dto';

describe('ListMotivationSchemasHttpController', () => {
    it('передаёт query-параметры в ListMotivationSchemasService.execute как есть', async () => {
        await withRequestContext(async () => {
            const execute = jest.fn().mockResolvedValue([]);
            const service = {
                execute,
            } as unknown as ListMotivationSchemasService;
            const controller = new ListMotivationSchemasHttpController(service);
            const query: ListMotivationSchemasQueryDto = {
                targetType: 'Employee',
                targetId: 42,
                search: 'оклад',
            };

            const result = await controller.list(query);

            expect(execute).toHaveBeenCalledTimes(1);
            expect(execute).toHaveBeenCalledWith(query);
            expect(result).toEqual([]);
        });
    });
});
