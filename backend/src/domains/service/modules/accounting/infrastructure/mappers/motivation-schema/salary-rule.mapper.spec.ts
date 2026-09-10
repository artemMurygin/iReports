import { SalaryRuleMapper } from './salary-rule.mapper';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ServiceCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/service-completed.entity';
import { DepartmentPercentEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/department-percent.entity';
import { DepartmentPlanBonusEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/department-plan-bonus.entity';
import { DepartmentTurnoverBonusEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/department-turnover-bonus.entity';
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
                props: { price: 300 },
                createdAt,
                updatedAt,
            });

            expect(entity).toBeInstanceOf(PayPerHoursEntity);
            expect(entity.id).toBe('rule-1');
            expect(entity.name).toBe('Часы');
            expect(entity.targetRole).toBe('ENGINEER');
            expect(entity.config).toEqual({ price: 300 });
            // Часы — из контекста (ручной ввод, Фаза 7), а не из config.
            expect(
                entity.calculate({
                    ...buildContext(),
                    erpData: {
                        serviceCompletedItems: [],
                        hoursWorked: { fact: 4, prognose: 4 },
                    },
                }).amount,
            ).toBe(1200);
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

        // Implements FR2 of add-department-head-salary-rules (tasks.md раздел 12).
        it('восстанавливает DepartmentPercentEntity из записи БД', () => {
            const entity = mapper.toDomain({
                id: 'rule-6',
                motivationSchemaId: 'schema-1',
                type: 'DepartmentPercent',
                name: 'Процент от факта',
                targetRole: 'DEPARTMENT_HEAD',
                props: { salaryBasis: 'REVENUE', category: null, percent: 5 },
                createdAt,
                updatedAt,
            });

            expect(entity).toBeInstanceOf(DepartmentPercentEntity);
            expect(entity.config).toEqual({
                salaryBasis: 'REVENUE',
                category: null,
                percent: 5,
            });
        });

        // Implements FR3 of add-department-head-salary-rules (tasks.md раздел 12).
        it('восстанавливает DepartmentPlanBonusEntity из записи БД', () => {
            const entity = mapper.toDomain({
                id: 'rule-7',
                motivationSchemaId: 'schema-1',
                type: 'DepartmentPlanBonus',
                name: 'Бонус за план',
                targetRole: 'DEPARTMENT_HEAD',
                props: {
                    salaryBasis: 'REVENUE',
                    category: null,
                    fixedAmount: 10000,
                    percentBorders: [
                        {
                            name: 'A',
                            fromPlanPercent: 50,
                            multiplier: 0.5,
                            mode: 'FIX',
                        },
                        {
                            name: 'B',
                            fromPlanPercent: 70,
                            multiplier: 1,
                            mode: 'FIX',
                        },
                        {
                            name: 'C',
                            fromPlanPercent: 100,
                            multiplier: 1.5,
                            mode: 'FIX',
                        },
                    ],
                },
                createdAt,
                updatedAt,
            });

            expect(entity).toBeInstanceOf(DepartmentPlanBonusEntity);
        });

        // Implements FR4 of add-department-head-salary-rules (tasks.md раздел 12).
        it('восстанавливает DepartmentTurnoverBonusEntity из записи БД', () => {
            const entity = mapper.toDomain({
                id: 'rule-8',
                motivationSchemaId: 'schema-1',
                type: 'DepartmentTurnoverBonus',
                name: 'Бонус за оборачиваемость',
                targetRole: 'DEPARTMENT_HEAD',
                props: {
                    warehouseId: 1,
                    category: null,
                    fixedAmount: 5000,
                    planTurnoverRatio: 1,
                    percentBorders: [
                        {
                            name: 'A',
                            fromPlanPercent: 50,
                            multiplier: 0.5,
                            mode: 'FIX',
                        },
                        {
                            name: 'B',
                            fromPlanPercent: 70,
                            multiplier: 1,
                            mode: 'FIX',
                        },
                        {
                            name: 'C',
                            fromPlanPercent: 100,
                            multiplier: 1.5,
                            mode: 'FIX',
                        },
                    ],
                },
                createdAt,
                updatedAt,
            });

            expect(entity).toBeInstanceOf(DepartmentTurnoverBonusEntity);
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
            const entity = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'ENGINEER',
                config: { price: 500 },
            });

            const record = mapper.toPersistence(entity);

            expect(record).toMatchObject({
                id: entity.id,
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'ENGINEER',
                props: { price: 500 },
            });
            expect(record.createdAt).toBeInstanceOf(Date);
            expect(record.updatedAt).toBeInstanceOf(Date);
        });

        // Implements FR2 of add-department-head-salary-rules (tasks.md раздел 12).
        it('сериализует DepartmentPercentEntity в формат для записи в БД', () => {
            const entity = DepartmentPercentEntity.create({
                type: 'DepartmentPercent',
                name: 'Процент от факта',
                targetRole: 'DEPARTMENT_HEAD',
                config: { salaryBasis: 'REVENUE', category: null, percent: 5 },
            });

            const record = mapper.toPersistence(entity);

            expect(record).toMatchObject({
                id: entity.id,
                type: 'DepartmentPercent',
                targetRole: 'DEPARTMENT_HEAD',
                props: { salaryBasis: 'REVENUE', category: null, percent: 5 },
            });
        });
    });
});
