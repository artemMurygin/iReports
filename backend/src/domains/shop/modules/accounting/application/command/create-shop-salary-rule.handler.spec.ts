import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateShopSalaryRuleHandler } from './create-shop-salary-rule.handler';
import { CreateShopSalaryRuleCommand } from './create-shop-salary-rule.command';
import type { ShopSalaryRuleRepositoryPort } from '../ports/shop-salary-rule.port';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';

describe('CreateShopSalaryRuleHandler', () => {
    const buildHandler = () => {
        const insert = jest
            .fn<
                Promise<void>,
                [ShopSalaryRule, { motivationSchemaId: string }]
            >()
            .mockResolvedValue(undefined);
        const shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort = {
            insert,
            deleteAllByMotivationSchema: jest.fn().mockResolvedValue(undefined),
        };
        const handler = new CreateShopSalaryRuleHandler(shopSalaryRuleRepo);
        return { handler, insert };
    };

    it('создаёт правило нужного типа через ShopSalaryRuleFactory и сохраняет его', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler();
            const command = new CreateShopSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                rule: {
                    type: 'PayPerHour',
                    name: 'Часы',
                    targetRole: 'OFFLINE_MANAGER',
                    config: { price: 200 },
                },
            });

            await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(1);
            const [entity, meta] = insert.mock.calls[0];
            expect(entity).toBeInstanceOf(PayPerHourShopEntity);
            expect(
                entity.calculate({
                    employee: { id: 1, identities: [] },
                    period: {
                        direction: 'shop',
                        period: '2026-08',
                        from: new Date('2026-08-01T00:00:00.000Z'),
                        to: new Date('2026-08-31T23:59:59.999Z'),
                        status: 'OPEN',
                    },
                    mode: 'FACT',
                    erpData: { hoursWorked: { fact: 5, prognose: 5 } },
                    salesPerformance: null,
                }).amount,
            ).toBe(1000);
            expect(meta).toEqual({ motivationSchemaId: 'schema-1' });
        });
    });

    it('возвращает id созданного правила', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler();
            const command = new CreateShopSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                rule: {
                    type: 'ProductSold',
                    name: 'Продажи',
                    targetRole: 'OFFLINE_MANAGER',
                    config: {
                        category: null,
                        award: { type: 'Fixed', price: 100 },
                    },
                },
            });

            const result = await handler.execute(command);

            expect(result.id).toEqual(expect.any(String));
        });
    });
});
