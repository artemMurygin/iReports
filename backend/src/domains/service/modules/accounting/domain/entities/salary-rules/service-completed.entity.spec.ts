import { ServiceCompletedEntity } from './service-completed.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type {
    ServiceCalculationErpData,
    ServiceCompletedErpItem,
} from '@/domains/service/modules/accounting/domain/types/calculation-data.types';

// Юнит-тесты на подготовленном объекте контекста — без поднятия БД и без
// моков репозиториев (см. docs/payroll/prd-payroll-calculation.md, Фаза 1
// и Фаза 7 — "ни один calculate() этих правил не возвращает константу").

const buildItem = (
    overrides: Partial<ServiceCompletedErpItem> = {},
): ServiceCompletedErpItem => ({
    serviceOrderId: 1,
    orderId: 100,
    orderLabel: 'А000100',
    brand: null,
    deviceModel: null,
    deviceColor: null,
    malfunction: null,
    serviceId: 10,
    quantity: 1,
    linePrice: 1000,
    catalogEngineerBonus: 150,
    serviceName: 'Замена экрана',
    engineerId: 42,
    managerId: null,
    onlineManager: null,
    orderTypeId: 1,
    ...overrides,
});

const buildContext = (
    items: ServiceCompletedErpItem[],
    identities: CalculationContext['employee']['identities'] = [
        { system: 'ROAPP', identifierType: 'EMPLOYEE_ID', externalId: '42' },
    ],
): CalculationContext => ({
    employee: { id: 1, identities },
    period: {
        direction: 'service',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode: 'FACT',
    erpData: {
        serviceCompletedItems: items,
        hoursWorked: { fact: 0, prognose: 0 },
    } satisfies ServiceCalculationErpData,
    salesPerformance: null,
});

describe('ServiceCompletedEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом ServiceCompleted', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 100 } },
            });

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('ServiceCompleted');
            expect(rule.name).toBe('За выполненную услугу');
            expect(rule.targetRole).toBe('ENGINEER');
            expect(rule.config).toEqual({
                award: { type: 'Fixed', price: 100 },
            });
        });
    });

    describe('calculate — award Fixed', () => {
        it('платит фиксированную сумму за единицу количества по совпавшим позициям', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 100 } },
            });
            const items = [
                buildItem({ serviceOrderId: 1, quantity: 2, engineerId: 42 }),
                buildItem({ serviceOrderId: 2, quantity: 1, engineerId: 42 }),
            ];

            const line = rule.calculate(buildContext(items));

            expect(line).toEqual({
                ruleId: rule.id,
                quantity: 3,
                rate: 100,
                amount: 300,
                sources: [
                    {
                        type: 'serviceOrderItem',
                        id: 1,
                        label: 'А000100',
                        link: 'https://web.roapp.io/orders/table/100',
                        amount: 200,
                        itemName: 'Замена экрана',
                    },
                    {
                        type: 'serviceOrderItem',
                        id: 2,
                        label: 'А000100',
                        link: 'https://web.roapp.io/orders/table/100',
                        amount: 100,
                        itemName: 'Замена экрана',
                    },
                ],
            });
        });
    });

    describe('calculate — award ServiceFixed', () => {
        it('платит ставку из справочника услуги за единицу количества', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'ServiceFixed' } },
            });
            const items = [
                buildItem({
                    serviceOrderId: 1,
                    quantity: 2,
                    catalogEngineerBonus: 150,
                    engineerId: 42,
                }),
                buildItem({
                    serviceOrderId: 2,
                    quantity: 1,
                    catalogEngineerBonus: 400,
                    engineerId: 42,
                }),
            ];

            const line = rule.calculate(buildContext(items));

            // 150*2 + 400*1 = 700, разные услуги — разная ставка справочника,
            // единого rate для строки нет (см. CalculationLine.rate).
            expect(line).toEqual({
                ruleId: rule.id,
                quantity: 3,
                amount: 700,
                sources: [
                    {
                        type: 'serviceOrderItem',
                        id: 1,
                        label: 'А000100',
                        link: 'https://web.roapp.io/orders/table/100',
                        amount: 300,
                        itemName: 'Замена экрана',
                    },
                    {
                        type: 'serviceOrderItem',
                        id: 2,
                        label: 'А000100',
                        link: 'https://web.roapp.io/orders/table/100',
                        amount: 400,
                        itemName: 'Замена экрана',
                    },
                ],
            });
        });
    });

    describe('calculate — award ServicePercent', () => {
        it('платит процент от стоимости услуги, округляя до целого рубля', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'ServicePercent', percent: 15 } },
            });
            const items = [
                buildItem({ serviceOrderId: 1, quantity: 1, linePrice: 999 }),
            ];

            const line = rule.calculate(buildContext(items));

            // 999 * 0.15 = 149.85 → 150 (Math.round).
            expect(line).toEqual({
                ruleId: rule.id,
                salaryBasis: 'SERVICE_PRICE',
                quantity: 1,
                rate: 15,
                amount: 150,
                sources: [
                    {
                        type: 'serviceOrderItem',
                        id: 1,
                        label: 'А000100',
                        link: 'https://web.roapp.io/orders/table/100',
                        amount: 150,
                        itemName: 'Замена экрана',
                    },
                ],
            });
        });
    });

    describe('calculate — наименование модели устройства и неисправность', () => {
        it('прокидывает brand/deviceModel/deviceColor/malfunction в sources', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 100 } },
            });
            const items = [
                buildItem({
                    serviceOrderId: 1,
                    quantity: 1,
                    brand: 'Apple',
                    deviceModel: 'iPhone 12 Pro',
                    deviceColor: 'Space Gray',
                    malfunction: 'Не включается',
                }),
            ];

            const line = rule.calculate(buildContext(items));

            expect(line.sources[0]).toMatchObject({
                brand: 'Apple',
                deviceModel: 'iPhone 12 Pro',
                deviceColor: 'Space Gray',
                malfunction: 'Не включается',
            });
        });
    });

    describe('calculate — название услуги (itemName)', () => {
        it('прокидывает RoappService.name из serviceName источника в sources[].itemName', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 100 } },
            });
            const items = [
                buildItem({
                    serviceOrderId: 1,
                    quantity: 1,
                    serviceName: 'Диагностика',
                }),
                buildItem({
                    serviceOrderId: 2,
                    quantity: 1,
                    serviceName: 'Замена аккумулятора',
                }),
            ];

            const line = rule.calculate(buildContext(items));

            expect(line.sources[0].itemName).toBe('Диагностика');
            expect(line.sources[1].itemName).toBe('Замена аккумулятора');
        });
    });

    describe('роль ENGINEER — выборка только по своим позициям', () => {
        it('считает только позиции со своим инженером, чужие не участвуют', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 100 } },
            });
            const items = [
                buildItem({ serviceOrderId: 1, quantity: 1, engineerId: 42 }),
                // другой инженер — не должен попасть в выборку.
                buildItem({ serviceOrderId: 2, quantity: 5, engineerId: 99 }),
            ];

            const line = rule.calculate(buildContext(items));

            expect(line.quantity).toBe(1);
            expect(line.amount).toBe(100);
            expect(line.sources).toEqual([
                {
                    type: 'serviceOrderItem',
                    id: 1,
                    label: 'А000100',
                    link: 'https://web.roapp.io/orders/table/100',
                    amount: 100,
                    itemName: 'Замена экрана',
                },
            ]);
        });

        it('без совпадающих позиций возвращает нулевую сумму', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 100 } },
            });
            const items = [
                buildItem({ serviceOrderId: 1, quantity: 1, engineerId: 99 }),
            ];

            expect(rule.calculate(buildContext(items)).amount).toBe(0);
        });
    });

    describe('фильтр по категории заказа (orderTypeIds)', () => {
        it('без orderTypeIds (или с []) считает позиции заказов всех типов — регрессия', () => {
            const ruleWithoutFilter = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 100 } },
            });
            const ruleWithEmptyFilter = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: {
                    award: { type: 'Fixed', price: 100 },
                    orderTypeIds: [],
                },
            });
            const items = [
                buildItem({ serviceOrderId: 1, quantity: 1, orderTypeId: 1 }),
                buildItem({ serviceOrderId: 2, quantity: 1, orderTypeId: 2 }),
            ];

            expect(
                ruleWithoutFilter.calculate(buildContext(items)).amount,
            ).toBe(200);
            expect(
                ruleWithEmptyFilter.calculate(buildContext(items)).amount,
            ).toBe(200);
        });

        it('с orderTypeIds считает только позиции заказов указанных типов', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: {
                    award: { type: 'Fixed', price: 100 },
                    orderTypeIds: [1],
                },
            });
            const items = [
                buildItem({ serviceOrderId: 1, quantity: 1, orderTypeId: 1 }),
                buildItem({ serviceOrderId: 2, quantity: 1, orderTypeId: 2 }),
            ];

            const line = rule.calculate(buildContext(items));
            expect(line.quantity).toBe(1);
            expect(line.amount).toBe(100);
            expect(line.sources).toHaveLength(1);
            expect(line.sources[0].id).toBe(1);
        });
    });

    describe('роль ONLINE_MANAGER — строковое поле заказа', () => {
        it('сопоставляет по EmployeeIdentity типа ONLINE_MANAGER_FIELD', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу онлайн-менеджером',
                targetRole: 'ONLINE_MANAGER',
                config: { award: { type: 'Fixed', price: 50 } },
            });
            const items = [
                buildItem({
                    serviceOrderId: 1,
                    quantity: 1,
                    onlineManager: 'ivan.petrov',
                }),
                buildItem({
                    serviceOrderId: 2,
                    quantity: 1,
                    onlineManager: 'another.manager',
                }),
            ];
            const identities: CalculationContext['employee']['identities'] = [
                {
                    system: 'ROAPP',
                    identifierType: 'ONLINE_MANAGER_FIELD',
                    externalId: 'ivan.petrov',
                },
            ];

            const line = rule.calculate(buildContext(items, identities));

            expect(line.amount).toBe(50);
            expect(line.sources).toEqual([
                {
                    type: 'serviceOrderItem',
                    id: 1,
                    label: 'А000100',
                    link: 'https://web.roapp.io/orders/table/100',
                    amount: 50,
                    itemName: 'Замена экрана',
                },
            ]);
        });
    });
});
