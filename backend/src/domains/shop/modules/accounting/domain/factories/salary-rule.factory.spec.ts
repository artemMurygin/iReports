import { NotFoundException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { ShopSalaryRuleFactory } from './salary-rule.factory';
import { PayPerHourShopEntity } from '../entities/salary-rules/pay-per-hour.entity';
import { ProductSoldEntity } from '../entities/salary-rules/product-sold.entity';
import { UsedProductSoldEntity } from '../entities/salary-rules/used-product-sold.entity';

describe('ShopSalaryRuleFactory', () => {
    it('создаёт PayPerHourShopEntity для типа PayPerHour', () => {
        const rule = ShopSalaryRuleFactory.create({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ONLINE_MANAGER',
            config: { price: 100 },
        });

        expect(rule).toBeInstanceOf(PayPerHourShopEntity);
    });

    it('создаёт ProductSoldEntity для типа ProductSold', () => {
        const rule = ShopSalaryRuleFactory.create({
            type: 'ProductSold',
            name: 'За проданный товар',
            targetRole: 'ONLINE_MANAGER',
            config: {
                category: null,
                award: { type: 'Fixed', price: 100 },
            },
        });

        expect(rule).toBeInstanceOf(ProductSoldEntity);
    });

    it('создаёт UsedProductSoldEntity для типа UsedProductSold', () => {
        const rule = ShopSalaryRuleFactory.create({
            type: 'UsedProductSold',
            name: 'Закупщик БУ техники',
            targetRole: 'ONLINE_PURCHASER',
            config: {
                category: null,
                award: { type: 'Fixed', price: 500 },
            },
        });

        expect(rule).toBeInstanceOf(UsedProductSoldEntity);
    });

    it('выбрасывает NotFoundException для незарегистрированного типа', () => {
        withRequestContext(() => {
            expect(() =>
                ShopSalaryRuleFactory.create({
                    // Тип не зарегистрирован в shopSalaryRuleRegistry этого
                    // домена (Фаза 12/13 реализует PayPerHour/ProductSold/
                    // UsedProductSold — полный набор первой итерации
                    // магазина).
                    type: 'UnknownRuleType' as never,
                    name: 'Неизвестное правило',
                    targetRole: 'ONLINE_MANAGER' as never,
                    config: {} as never,
                }),
            ).toThrow(NotFoundException);
        });
    });

    // issue #61: типы правил сервиса и магазина не пересекаются — сервисный
    // 'ServiceCompleted' (не существующий у магазина) обязан провалиться
    // фабрикой магазина так же, как и полностью неизвестный тип.
    it('не создаёт правило по типу, зарегистрированному только у сервиса', () => {
        withRequestContext(() => {
            expect(() =>
                ShopSalaryRuleFactory.create({
                    type: 'ServiceCompleted' as never,
                    name: 'За услугу',
                    targetRole: 'ONLINE_MANAGER' as never,
                    config: {} as never,
                }),
            ).toThrow(NotFoundException);
        });
    });
});
