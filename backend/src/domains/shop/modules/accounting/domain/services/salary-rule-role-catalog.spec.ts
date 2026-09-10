import { listShopSalaryRuleTypes } from './salary-rule-role-catalog';

// Снапшот типов правил зарплаты service (Фаза 9
// docs/service-shop-boundary-violations-fix) — раньше тест напрямую
// импортировал `listSalaryRuleTypes` из `domains/service/modules/accounting`
// для сравнения множеств; такой импорт сам по себе — нарушение границы
// shop → service (тест общей проверки не должен тянуть живой реестр
// соседнего домена). Значения захардкожены по актуальному состоянию
// `domains/service/modules/accounting/domain/salary-rule-registry.ts` — при
// изменении набора типов правил service этот снапшот нужно обновить вручную
// (намеренный trade-off: проверка независимости множеств важнее live-связи
// с service).
const SERVICE_SALARY_RULE_TYPES = [
    'PayPerHour',
    'ServiceCompleted',
    'OrderPayed',
    'TaskCompletion',
    // Раздел 12 tasks.md (add-department-head-salary-rules).
    'DepartmentPercent',
    'DepartmentPlanBonus',
    'DepartmentTurnoverBonus',
];

describe('listShopSalaryRuleTypes', () => {
    it('отдаёт только зарегистрированные типы правил магазина (раздел 15 — 4 типа вместо 3 после регистрации TaskCompletion; раздел 13 — ещё 3 новых вида уровня отдела)', () => {
        const types = listShopSalaryRuleTypes().map((entry) => entry.type);
        expect(types.sort()).toEqual([
            'DepartmentPercent',
            'DepartmentPlanBonus',
            'DepartmentTurnoverBonus',
            'PayPerHour',
            'ProductSold',
            'TaskCompletion',
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
                    // FR1 add-department-head-salary-rules — «руководитель направления» доступен
                    // как опция роли для 3 новых видов правил (design.md Decision 4).
                    'DEPARTMENT_HEAD',
                ]),
            );
        }
    });

    // issue #61: "GET списка типов правил возвращает разные наборы для
    // service и shop; типы правил сервиса и магазина не пересекаются" — как
    // РЕЕСТРЫ (независимые Map/классы), даже когда буквальные строковые
    // имена типов совпадают ('PayPerHour', и с раздела 15 — 'TaskCompletion').
    it('набор типов не пересекается с сервисом, кроме совпадающих по имени PayPerHour/TaskCompletion', () => {
        const shopTypes = new Set(
            listShopSalaryRuleTypes().map((entry) => entry.type),
        );
        const serviceTypes = new Set(SERVICE_SALARY_RULE_TYPES);

        expect(shopTypes).not.toEqual(serviceTypes);
        // 'ServiceCompleted'/'OrderPayed' — только у сервиса.
        expect(shopTypes.has('ServiceCompleted')).toBe(false);
        expect(shopTypes.has('OrderPayed')).toBe(false);
        // 'ProductSold'/'UsedProductSold' — только у магазина.
        expect(serviceTypes.has('ProductSold')).toBe(false);
        expect(serviceTypes.has('UsedProductSold')).toBe(false);
    });
});
