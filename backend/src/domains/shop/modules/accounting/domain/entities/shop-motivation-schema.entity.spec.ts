import { withRequestContext } from '@/shared/testing/with-request-context';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { ShopMotivationSchema } from './shop-motivation-schema.entity';
import { ShopMotivationSchemaCreatedDomainEvent } from '../events/shop-motivation-schema-created.domain-event';
import { PayPerHourShopEntity } from './salary-rules/pay-per-hour.entity';

describe('ShopMotivationSchema', () => {
    const baseProps = {
        targetType: 'Employee',
        targetId: 42,
        name: 'Оклад продавца',
    };

    describe('create', () => {
        it('генерирует id и сохраняет переданные props', () => {
            withRequestContext(() => {
                const rule = PayPerHourShopEntity.create({
                    type: 'PayPerHour',
                    name: 'Почасовая ставка',
                    targetRole: 'OFFLINE_MANAGER',
                    config: { price: 500 },
                });

                const schema = ShopMotivationSchema.create({
                    ...baseProps,
                    rules: [rule],
                });

                expect(schema.id).toEqual(expect.any(String));
                const props = schema.getProps();
                expect(props.target.getType()).toBe(baseProps.targetType);
                expect(props.target.getId()).toBe(baseProps.targetId);
                expect(props.name).toBe(baseProps.name);
                expect(props.rules).toEqual([rule]);
            });
        });

        it('добавляет ShopMotivationSchemaCreatedDomainEvent с данными созданной схемы', () => {
            withRequestContext(() => {
                const schema = ShopMotivationSchema.create({
                    ...baseProps,
                    rules: [],
                });

                expect(schema.domainEvents).toHaveLength(1);
                const [event] = schema.domainEvents as [
                    ShopMotivationSchemaCreatedDomainEvent,
                ];
                expect(event).toBeInstanceOf(
                    ShopMotivationSchemaCreatedDomainEvent,
                );
                expect(event.aggregateId).toBe(schema.id);
                expect(event.target.getType()).toBe(baseProps.targetType);
                expect(event.target.getId()).toBe(baseProps.targetId);
                expect(event.name).toBe(baseProps.name);
                expect(event.rules).toEqual([]);
            });
        });

        it('выбрасывает ArgumentInvalidException без targetType', () => {
            withRequestContext(() => {
                expect(() =>
                    ShopMotivationSchema.create({
                        ...baseProps,
                        targetType: '',
                        rules: [],
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('выбрасывает ArgumentInvalidException без targetId', () => {
            withRequestContext(() => {
                expect(() =>
                    ShopMotivationSchema.create({
                        ...baseProps,
                        targetId: 0,
                        rules: [],
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });
    });
});
