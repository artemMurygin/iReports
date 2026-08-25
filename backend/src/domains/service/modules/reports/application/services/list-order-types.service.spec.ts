import { ListOrderTypesService } from './list-order-types.service';
import type { ServiceSalesSourcePort } from '../ports/service-sales.port';
import { OrderType } from '../../domain/value-objects/order-type.value-object';

describe('ListOrderTypesService', () => {
    const buildService = (orderTypes: OrderType[]) => {
        const listOrderTypes = jest
            .fn<Promise<OrderType[]>, []>()
            .mockResolvedValue(orderTypes);
        const source: ServiceSalesSourcePort = {
            findByFilter: jest.fn(),
            listCategories: jest.fn(),
            listOrderTypes,
        };

        return { service: new ListOrderTypesService(source), listOrderTypes };
    };

    it('возвращает пустой список, если справочник пуст', async () => {
        const { service } = buildService([]);

        const result = await service.execute();

        expect(result).toEqual([]);
    });

    it('маппит VO из порта в плоскую форму контракта', async () => {
        const { service } = buildService([
            OrderType.create({ id: 1, name: 'Гарантийный' }),
            OrderType.create({ id: 2, name: 'Платный' }),
        ]);

        const result = await service.execute();

        expect(result).toEqual([
            { id: 1, name: 'Гарантийный' },
            { id: 2, name: 'Платный' },
        ]);
    });
});
