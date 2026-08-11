import { listShopSalaryRuleTypes } from './salary-rule-role-catalog';
import { listSalaryRuleTypes } from '@/domains/service/modules/accounting/domain/services/salary-rule-role-catalog';

describe('listShopSalaryRuleTypes', () => {
    it('отдаёт только зарегистрированные типы правил магазина (Фаза 12/13)', () => {
        const types = listShopSalaryRuleTypes().map((entry) => entry.type);
        expect(types.sort()).toEqual([
            'PayPerHour',
            'ProductSold',
            'TaskCompleted',
            'UsedProductSold',
        ]);
    });

    it('каждому типу отдан непустой список допустимых ролей магазина', () => {
        for (const entry of listShopSalaryRuleTypes()) {
            expect(entry.allowedRoles).toEqual(
                expect.arrayContaining([
                    'ONLINE_MANAGER',
                    'OFFLINE_MANAGER',
                    'ONLINE_PURCHASER',
                    'OFFLINE_PURCHASER',
                ]),
            );
        }
    });

    // issue #61: "GET списка типов правил возвращает разные наборы для
    // service и shop; типы правил сервиса и магазина не пересекаются" — как
    // РЕЕСТРЫ (независимые Map/классы), даже когда буквальные строковые
    // имена типов совпадают ('PayPerHour', 'TaskCompleted', Фаза 13).
    it('набор типов не пересекается с сервисом, кроме совпадающих по имени PayPerHour/TaskCompleted', () => {
        const shopTypes = new Set(
            listShopSalaryRuleTypes().map((entry) => entry.type),
        );
        const serviceTypes = new Set(
            listSalaryRuleTypes().map((entry) => entry.type),
        );

        expect(shopTypes).not.toEqual(serviceTypes);
        // 'ServiceCompleted'/'OrderPayed' — только у сервиса.
        expect(shopTypes.has('ServiceCompleted')).toBe(false);
        expect(shopTypes.has('OrderPayed')).toBe(false);
        // 'ProductSold'/'UsedProductSold' — только у магазина.
        expect(serviceTypes.has('ProductSold')).toBe(false);
        expect(serviceTypes.has('UsedProductSold')).toBe(false);
    });
});
