import { ShopMotivationSchemaMapper } from './shop-motivation-schema.mapper';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('ShopMotivationSchemaMapper', () => {
    const mapper = new ShopMotivationSchemaMapper();
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const updatedAt = new Date('2024-01-02T00:00:00.000Z');

    describe('toDomain', () => {
        it('восстанавливает ShopMotivationSchema вместе со связанными правилами', () => {
            const schema = mapper.toDomain({
                id: 'schema-1',
                targetType: 'Employee',
                targetId: 7,
                name: 'Оклад',
                createdAt,
                updatedAt,
                rules: [
                    {
                        id: 'rule-1',
                        motivationSchemaId: 'schema-1',
                        type: 'PayPerHour',
                        name: 'Часы',
                        targetRole: 'OFFLINE_MANAGER',
                        props: { price: 300 },
                        createdAt,
                        updatedAt,
                    },
                ],
            });

            expect(schema).toBeInstanceOf(ShopMotivationSchema);
            expect(schema.id).toBe('schema-1');
            const props = schema.getProps();
            expect(props.target.getType()).toBe('Employee');
            expect(props.target.getId()).toBe(7);
            expect(props.name).toBe('Оклад');
            expect(props.rules).toHaveLength(1);
            expect(
                props.rules[0].calculate({
                    employee: { id: 7, identities: [] },
                    period: {
                        direction: 'shop',
                        period: '2026-08',
                        from: new Date('2026-08-01T00:00:00.000Z'),
                        to: new Date('2026-08-31T23:59:59.999Z'),
                        status: 'OPEN',
                    },
                    mode: 'FACT',
                    erpData: { hoursWorked: 2 },
                    salesPerformance: null,
                }).amount,
            ).toBe(600);
        });

        it('восстанавливает схему без правил как пустой список', () => {
            const schema = mapper.toDomain({
                id: 'schema-2',
                targetType: 'Department',
                targetId: 1,
                name: 'Оклад отдела',
                createdAt,
                updatedAt,
                rules: [],
            });

            expect(schema.getProps().rules).toEqual([]);
        });
    });

    describe('toPersistence', () => {
        it('сериализует схему в формат для записи в БД без вложенных правил', () => {
            withRequestContext(() => {
                const schema = ShopMotivationSchema.create({
                    targetType: 'Employee',
                    targetId: 7,
                    name: 'Оклад',
                    rules: [],
                });

                const record = mapper.toPersistence(schema);

                expect(record).toMatchObject({
                    id: schema.id,
                    targetType: 'Employee',
                    targetId: 7,
                    name: 'Оклад',
                });
                expect(record).not.toHaveProperty('rules');
            });
        });
    });
});
