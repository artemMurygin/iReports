import { withRequestContext } from '@/shared/testing/with-request-context';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { MotivationSchema } from './motivation-schema.entity';
import { MotivationSchemaCreatedDomainEvent } from '../events/motivation-schema-created.domain-event';
import { PayPerHoursEntity } from './salary-rules/pay-per-hour.entity';

describe('MotivationSchema', () => {
    const baseProps = {
        targetType: 'Employee',
        targetId: 42,
        name: 'Оклад инженера',
    };

    describe('create', () => {
        it('генерирует id и сохраняет переданные props', () => {
            withRequestContext(() => {
                const rule = PayPerHoursEntity.create({
                    type: 'PayPerHour',
                    name: 'Почасовая ставка',
                    targetRole: 'ENGINEER',
                    config: { price: 500 },
                });

                const schema = MotivationSchema.create({
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

        it('добавляет MotivationSchemaCreatedDomainEvent с данными созданной схемы', () => {
            withRequestContext(() => {
                const schema = MotivationSchema.create({
                    ...baseProps,
                    rules: [],
                });

                expect(schema.domainEvents).toHaveLength(1);
                const [event] = schema.domainEvents as [
                    MotivationSchemaCreatedDomainEvent,
                ];
                expect(event).toBeInstanceOf(
                    MotivationSchemaCreatedDomainEvent,
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
                    MotivationSchema.create({
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
                    MotivationSchema.create({
                        ...baseProps,
                        targetId: 0,
                        rules: [],
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });
    });
});
