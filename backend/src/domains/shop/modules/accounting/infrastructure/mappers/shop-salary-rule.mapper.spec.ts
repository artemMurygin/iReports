import { ShopSalaryRuleMapper } from './shop-salary-rule.mapper';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ProductSoldEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/product-sold.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';

const buildContext = (): CalculationContext => ({
    employee: { id: 1, identities: [] },
    period: {
        direction: 'shop',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode: 'FACT',
    erpData: undefined,
    salesPerformance: null,
});

describe('ShopSalaryRuleMapper', () => {
    const mapper = new ShopSalaryRuleMapper();
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const updatedAt = new Date('2024-01-02T00:00:00.000Z');

    describe('toDomain', () => {
        it('восстанавливает PayPerHourShopEntity из записи БД', () => {
            const entity = mapper.toDomain({
                id: 'rule-1',
                motivationSchemaId: 'schema-1',
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'OFFLINE_MANAGER',
                props: { price: 300 },
                createdAt,
                updatedAt,
            });

            expect(entity).toBeInstanceOf(PayPerHourShopEntity);
            expect(entity.id).toBe('rule-1');
            expect(entity.name).toBe('Часы');
            expect(entity.targetRole).toBe('OFFLINE_MANAGER');
            expect(entity.config).toEqual({ price: 300 });
            expect(
                entity.calculate({
                    ...buildContext(),
                    erpData: { hoursWorked: 4 },
                }).amount,
            ).toBe(1200);
        });

        it('восстанавливает ProductSoldEntity из записи БД', () => {
            const entity = mapper.toDomain({
                id: 'rule-2',
                motivationSchemaId: 'schema-1',
                type: 'ProductSold',
                name: 'Продажи',
                targetRole: 'OFFLINE_MANAGER',
                props: {
                    category: null,
                    award: { type: 'Fixed', price: 100 },
                },
                createdAt,
                updatedAt,
            });

            expect(entity).toBeInstanceOf(ProductSoldEntity);
            expect(entity.config).toEqual({
                category: null,
                award: { type: 'Fixed', price: 100 },
            });
        });

        it('выбрасывает ошибку для неизвестного type', () => {
            expect(() =>
                mapper.toDomain({
                    id: 'rule-3',
                    motivationSchemaId: 'schema-1',
                    type: 'Unknown',
                    name: 'Что-то',
                    targetRole: 'OFFLINE_MANAGER',
                    props: {},
                    createdAt,
                    updatedAt,
                }),
            ).toThrow();
        });

        it('выбрасывает ошибку, если props не проходит валидацию по схеме типа', () => {
            expect(() =>
                mapper.toDomain({
                    id: 'rule-4',
                    motivationSchemaId: 'schema-1',
                    type: 'PayPerHour',
                    name: 'Часы',
                    targetRole: 'OFFLINE_MANAGER',
                    // price обязателен схемой payPerHourShopSalaryConfigSchema
                    props: {},
                    createdAt,
                    updatedAt,
                }),
            ).toThrow();
        });

        it('выбрасывает ошибку для неизвестной targetRole', () => {
            expect(() =>
                mapper.toDomain({
                    id: 'rule-5',
                    motivationSchemaId: 'schema-1',
                    type: 'PayPerHour',
                    name: 'Часы',
                    targetRole: 'UNKNOWN_ROLE',
                    props: { price: 300 },
                    createdAt,
                    updatedAt,
                }),
            ).toThrow();
        });
    });

    describe('toPersistence', () => {
        it('сериализует правило в формат для записи в БД', () => {
            const entity = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'OFFLINE_MANAGER',
                config: { price: 500 },
            });

            const record = mapper.toPersistence(entity);

            expect(record).toMatchObject({
                id: entity.id,
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'OFFLINE_MANAGER',
                props: { price: 500 },
                direction: 'shop',
            });
            expect(record.createdAt).toBeInstanceOf(Date);
            expect(record.updatedAt).toBeInstanceOf(Date);
        });
    });
});
