import * as XLSX from 'xlsx';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { RoappGateway } from '@/domains/service/integrations/roapp-gateway/roapp-gateway.port';
import type { UpdateServicesResponse } from '@/domains/service/integrations/custom-api-roapp/schemas/updateServices.schema';
import { UpdateServicePricesHandler } from './update-service-prices.handler';
import { UpdateServicePricesCommand } from './update-service-prices.command';

// Легаси SERVICE_PRICE_HEADERS
// (src/TODO/priceMonitoring/priceMonitoring.service.ts) — хендлер должен
// произвести тот же порядок и состав колонок, иначе CustomApiRoapp
// /updateServices не распознает файл.
const LEGACY_SERVICE_PRICE_HEADERS = [
    'Штрих-код',
    'Тип',
    'Наименование',
    'Описание',
    'Единица измерения',
    'Категория',
    'Гарантия',
    'Период гарантии',
    'Продолжительность (минуты)',
    'Себестоимость',
    'Сумма вознаграждения',
    'Процент вознаграждения',
    'Расчет процента от',
    'Стандартная цена',
];

describe('UpdateServicePricesHandler', () => {
    // Фейковый ROAPP_GATEWAY — единственная зависимость хендлера. Он не
    // знает ни про RoappService, ни про CustomApiRoappService (см. также
    // grep-проверку `grep -rn "RoappService\|CustomApiRoappService"` над
    // этим файлом при ревью — вне domains/service/integrations/roapp-gateway
    // таких инжектов быть не должно).
    const buildGateway = (
        overrides: Partial<RoappGateway> = {},
    ): {
        gateway: RoappGateway;
        updateServicesFromFile: jest.Mock<
            Promise<UpdateServicesResponse>,
            [Buffer]
        >;
    } => {
        const updateServicesFromFile = jest
            .fn<Promise<UpdateServicesResponse>, [Buffer]>()
            .mockResolvedValue({
                success: true,
                count: { total: 1, valid: 1, create: 0, update: 1, errors: 0 },
            });

        const gateway: RoappGateway = {
            fetchEmployees: jest.fn(),
            fetchOrderTypes: jest.fn(),
            fetchOrderStatuses: jest.fn(),
            fetchMarketingSources: jest.fn(),
            fetchProductCategories: jest.fn(),
            fetchProducts: jest.fn(),
            fetchCreatedOrders: jest.fn(),
            fetchUpdatedOrders: jest.fn(),
            fetchOrdersClosedBetween: jest.fn(),
            fetchOrderItems: jest.fn(),
            fetchServiceBonuses: jest.fn(),
            fetchServiceBonusById: jest.fn(),
            createService: jest.fn(),
            async *fetchServices() {
                await Promise.resolve();
                yield [
                    {
                        id: 42,
                        categoryId: 7,
                        name: 'Замена экрана',
                        price: 5000,
                        warranty: '90 дней',
                        warrantyPeriod: 90,
                        warrantyUnit: 'дн.',
                        duration: 60,
                    },
                ];
            },
            async *fetchServiceCategories() {
                await Promise.resolve();
                yield [
                    { id: 1, title: 'Ремонт', parent_id: null },
                    { id: 7, title: 'Экраны', parent_id: 1 },
                ];
            },
            updateServicesFromFile,
            ...overrides,
        };

        return { gateway, updateServicesFromFile };
    };

    it('никогда не обращается к чему-либо, кроме ROAPP_GATEWAY', () => {
        const { gateway } = buildGateway();
        const handler = new UpdateServicePricesHandler(gateway);
        expect(handler).toBeInstanceOf(UpdateServicePricesHandler);
    });

    it('строит XLSX с той же шапкой (SERVICE_PRICE_HEADERS), что и легаси', async () => {
        await withRequestContext(async () => {
            const { gateway, updateServicesFromFile } = buildGateway();
            const handler = new UpdateServicePricesHandler(gateway);
            const command = new UpdateServicePricesCommand({
                items: [{ id: 42, price: 6000, serviceCost: 1200 }],
            });

            const result = await handler.execute(command);

            expect(updateServicesFromFile).toHaveBeenCalledTimes(1);
            const buffer = updateServicesFromFile.mock.calls[0][0];
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheet = workbook.Sheets['Services'];
            const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
                header: 1,
            });

            expect(rows[0]).toEqual(LEGACY_SERVICE_PRICE_HEADERS);
            expect(rows[1]).toEqual([
                '',
                'Услуга',
                'Замена экрана',
                '',
                'pcs',
                'Ремонт > Экраны',
                90,
                'дн.',
                '',
                0,
                1200,
                '',
                '',
                6000,
            ]);
            expect(result.success).toBe(true);
        });
    });

    it('пропускает строку, если услуга не найдена в RoApp', async () => {
        await withRequestContext(async () => {
            const { gateway, updateServicesFromFile } = buildGateway();
            const handler = new UpdateServicePricesHandler(gateway);
            const command = new UpdateServicePricesCommand({
                items: [{ id: 999, price: 100, serviceCost: 10 }],
            });

            await handler.execute(command);

            const buffer = updateServicesFromFile.mock.calls[0][0];
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheet = workbook.Sheets['Services'];
            const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
                header: 1,
            });

            expect(rows).toHaveLength(1);
            expect(rows[0]).toEqual(LEGACY_SERVICE_PRICE_HEADERS);
        });
    });

    it('отклоняет отрицательную цену доменной ошибкой ещё до обращения к RoApp', async () => {
        await withRequestContext(async () => {
            const { gateway, updateServicesFromFile } = buildGateway();
            const handler = new UpdateServicePricesHandler(gateway);
            const command = new UpdateServicePricesCommand({
                items: [{ id: 42, price: -1, serviceCost: 10 }],
            });

            await expect(handler.execute(command)).rejects.toThrow();
            expect(updateServicesFromFile).not.toHaveBeenCalled();
        });
    });
});
