import { MotivationSchemaMapper } from './motivation-schema.mapper';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('MotivationSchemaMapper', () => {
    const mapper = new MotivationSchemaMapper();
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const updatedAt = new Date('2024-01-02T00:00:00.000Z');

    describe('toDomain', () => {
        it('восстанавливает MotivationSchema вместе со связанными правилами', () => {
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
                        targetRole: 'ENGINEER',
                        props: { hours: 2, price: 300 },
                        createdAt,
                        updatedAt,
                    },
                ],
            });

            expect(schema).toBeInstanceOf(MotivationSchema);
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
                        direction: 'service',
                        period: '2026-08',
                        from: new Date('2026-08-01T00:00:00.000Z'),
                        to: new Date('2026-08-31T23:59:59.999Z'),
                        status: 'OPEN',
                    },
                    mode: 'FACT',
                    erpData: undefined,
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
                const schema = MotivationSchema.create({
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
