import { SalaryRuleMapper } from './salary-rule.mapper';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ServiceCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/service-completed.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';

const buildContext = (): CalculationContext => ({
    employee: { id: 1, identities: [] },
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
});

describe('SalaryRuleMapper', () => {
    const mapper = new SalaryRuleMapper();
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const updatedAt = new Date('2024-01-02T00:00:00.000Z');

    describe('toDomain', () => {
        it('восстанавливает PayPerHoursEntity из записи БД', () => {
            const entity = mapper.toDomain({
                id: 'rule-1',
                motivationSchemaId: 'schema-1',
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'ENGINEER',
                props: { hours: 4, price: 300 },
                createdAt,
                updatedAt,
            });

            expect(entity).toBeInstanceOf(PayPerHoursEntity);
            expect(entity.id).toBe('rule-1');
            expect(entity.name).toBe('Часы');
            expect(entity.targetRole).toBe('ENGINEER');
            expect(entity.config).toEqual({ hours: 4, price: 300 });
            expect(entity.calculate(buildContext()).amount).toBe(1200);
        });

        it('восстанавливает ServiceCompletedEntity из записи БД', () => {
            const entity = mapper.toDomain({
                id: 'rule-2',
                motivationSchemaId: 'schema-1',
                type: 'ServiceCompleted',
                name: 'Услуги',
                targetRole: 'ENGINEER',
                props: { award: { type: 'ServiceFixed' } },
                createdAt,
                updatedAt,
            });

            expect(entity).toBeInstanceOf(ServiceCompletedEntity);
            expect(entity.config).toEqual({ award: { type: 'ServiceFixed' } });
        });

        it('выбрасывает ошибку для неизвестного type', () => {
            expect(() =>
                mapper.toDomain({
                    id: 'rule-3',
                    motivationSchemaId: 'schema-1',
                    type: 'Unknown',
                    name: 'Что-то',
                    targetRole: 'ENGINEER',
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
                    targetRole: 'ENGINEER',
                    // price обязателен схемой payPerHourSalaryConfigSchema
                    props: { hours: 4 },
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
                    props: { hours: 4, price: 300 },
                    createdAt,
                    updatedAt,
                }),
            ).toThrow();
        });
    });

    describe('toPersistence', () => {
        it('сериализует правило в формат для записи в БД', () => {
            const entity = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'ENGINEER',
                config: { hours: 2, price: 500 },
            });

            const record = mapper.toPersistence(entity);

            expect(record).toMatchObject({
                id: entity.id,
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'ENGINEER',
                props: { hours: 2, price: 500 },
            });
            expect(record.createdAt).toBeInstanceOf(Date);
            expect(record.updatedAt).toBeInstanceOf(Date);
        });
    });
});
