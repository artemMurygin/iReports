import { ShopSalaryRuleMapper } from './salary-rule.mapper';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ProductSoldEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/product-sold.entity';
import { DepartmentPercentEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/department-percent.entity';
import { DepartmentPlanBonusEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/department-plan-bonus.entity';
import { DepartmentTurnoverBonusEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/department-turnover-bonus.entity';
import { TaskCompletionShop } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import type { TaskCompletionShopSalaryConfig } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { Period } from '@/shared/domain/period.value-object';
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
                direction: 'shop',
                isActive: true,
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
                    erpData: { hoursWorked: { fact: 4, prognose: 4 } },
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
                direction: 'shop',
                isActive: true,
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

        // Implements FR2 of add-department-head-salary-rules (tasks.md раздел 13).
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

        // Implements FR3 of add-department-head-salary-rules (tasks.md раздел 13).
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

        // Implements FR4 of add-department-head-salary-rules (tasks.md раздел 13).
        it('восстанавливает DepartmentTurnoverBonusEntity из записи БД', () => {
            const entity = mapper.toDomain({
                id: 'rule-8',
                motivationSchemaId: 'schema-1',
                type: 'DepartmentTurnoverBonus',
                name: 'Бонус за оборачиваемость',
                targetRole: 'DEPARTMENT_HEAD',
                props: {
                    warehouseId: 'wh-1',
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

        // add-task-salary-rule-accounting-period, design.md решение 1 —
        // зеркало SalaryRuleMapper.toDomain направления service: уже
        // персистированные строки TaskCompletion без accountingPeriod в
        // props должны продолжать читаться без ошибок валидации, с
        // деривацией значения на границе маппера.
        describe('деривация accountingPeriod для легаси-строк TaskCompletion (design.md решение 1)', () => {
            it('props без accountingPeriod, но с непустым taskIdByPeriod → берёт максимальный (лексикографически) ключ карты', () => {
                const entity = mapper.toDomain({
                    id: 'rule-9',
                    motivationSchemaId: 'schema-1',
                    type: 'TaskCompletion',
                    name: 'Собрать отчёт',
                    targetRole: 'OFFLINE_MANAGER',
                    direction: 'shop',
                    isActive: true,
                    props: {
                        taskIdByPeriod: {
                            '2026-01': 'task-1',
                            '2026-03': 'task-3',
                            '2026-02': 'task-2',
                        },
                        taskTitleTemplate: 'Собрать отчёт по продажам',
                        isRecurring: true,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 5000,
                    },
                    createdAt,
                    updatedAt,
                });

                expect(entity).toBeInstanceOf(TaskCompletionShop);
                expect(
                    (entity.config as TaskCompletionShopSalaryConfig)
                        .accountingPeriod,
                ).toBe('2026-03');
            });

            it('props без accountingPeriod и с пустым taskIdByPeriod → Period.current()', () => {
                const entity = mapper.toDomain({
                    id: 'rule-10',
                    motivationSchemaId: 'schema-1',
                    type: 'TaskCompletion',
                    name: 'Собрать отчёт',
                    targetRole: 'OFFLINE_MANAGER',
                    direction: 'shop',
                    isActive: true,
                    props: {
                        taskIdByPeriod: {},
                        taskTitleTemplate: 'Собрать отчёт по продажам',
                        isRecurring: true,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 5000,
                    },
                    createdAt,
                    updatedAt,
                });

                expect(
                    (entity.config as TaskCompletionShopSalaryConfig)
                        .accountingPeriod,
                ).toBe(Period.current().getValue());
            });

            it('props с уже заполненным accountingPeriod → значение передаётся как есть', () => {
                const entity = mapper.toDomain({
                    id: 'rule-11',
                    motivationSchemaId: 'schema-1',
                    type: 'TaskCompletion',
                    name: 'Собрать отчёт',
                    targetRole: 'OFFLINE_MANAGER',
                    direction: 'shop',
                    isActive: true,
                    props: {
                        taskIdByPeriod: {
                            '2026-01': 'task-1',
                            '2026-05': 'task-5',
                        },
                        taskTitleTemplate: 'Собрать отчёт по продажам',
                        isRecurring: true,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 5000,
                        accountingPeriod: '2026-01',
                    },
                    createdAt,
                    updatedAt,
                });

                expect(
                    (entity.config as TaskCompletionShopSalaryConfig)
                        .accountingPeriod,
                ).toBe('2026-01');
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
                    direction: 'shop',
                    isActive: true,
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
                    direction: 'shop',
                    isActive: true,
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
                    direction: 'shop',
                    isActive: true,
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

        // Implements FR2 of add-department-head-salary-rules (tasks.md раздел 13).
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
                direction: 'shop',
            });
        });
    });
});
