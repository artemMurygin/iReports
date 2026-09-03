import { MotivationSchemaMapper } from './motivation-schema.mapper';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
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
                serviceName: null,
                shopName: null,
                createdAt,
                updatedAt,
                rules: [
                    {
                        id: 'rule-1',
                        motivationSchemaId: 'schema-1',
                        type: 'PayPerHour',
                        name: 'Часы',
                        targetRole: 'ENGINEER',
                        props: { price: 300 },
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
                    erpData: {
                        serviceCompletedItems: [],
                        hoursWorked: { fact: 2, prognose: 2 },
                    },
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
                serviceName: null,
                shopName: null,
                createdAt,
                updatedAt,
                rules: [],
            });

            expect(schema.getProps().rules).toEqual([]);
        });

        it('читает serviceName, если он задан, вместо общей legacy-колонки name', () => {
            const schema = mapper.toDomain({
                id: 'schema-3',
                targetType: 'Employee',
                targetId: 9,
                // Общее (историческое/shop) значение — не должно попасть в
                // props.name, когда serviceName задан отдельно (регрессия
                // на кросс-направленческий баг переименования).
                name: 'Общее имя строки',
                serviceName: 'Имя для service',
                shopName: 'Имя для shop',
                createdAt,
                updatedAt,
                rules: [],
            });

            expect(schema.getProps().name).toBe('Имя для service');
        });

        it('фолбэк на legacy name, когда serviceName ещё не задан (строка до миграции)', () => {
            const schema = mapper.toDomain({
                id: 'schema-4',
                targetType: 'Employee',
                targetId: 10,
                name: 'Общее имя строки',
                serviceName: null,
                shopName: 'Имя для shop',
                createdAt,
                updatedAt,
                rules: [],
            });

            expect(schema.getProps().name).toBe('Общее имя строки');
        });
    });

    // Фаза 2 docs/task-rule-archiving-and-links: заархивированные разовые
    // TaskCompleted-правила не должны попадать в ответ "просмотр/
    // редактирование схемы" ни в каком виде (PRD, "В скоупе") — ни в
    // rules[], ни в ruleCount/ruleTypes. Регулярное (isRecurring: true)
    // и другие типы правил статуса не имеют вовсе и никогда не
    // фильтруются. Путь расчёта зарплаты (toDomain(), используемый
    // ResolveEmployeeSalaryRulesService) не затрагивается — см.
    // регрессионный тест resolve-employee-salary-rules.service.spec.ts
    // (Фаза 1).
    describe('фильтрация ARCHIVED-правил (toListItemResponse/toDetailResponse)', () => {
        const buildSchemaWithRules = () =>
            withRequestContext(() => {
                const archivedRule = TaskCompletedEntity.create({
                    type: 'TaskCompleted',
                    name: 'Заархивированная задача',
                    targetRole: 'ENGINEER',
                    config: {
                        description: 'Сделать что-то важное',
                        period: '2026-08',
                        isRecurring: false,
                        dueDate: '2026-08-15',
                        rewardAmount: 10000,
                    },
                });
                archivedRule.archive();

                const activeTaskRule = TaskCompletedEntity.create({
                    type: 'TaskCompleted',
                    name: 'Активная задача',
                    targetRole: 'ENGINEER',
                    config: {
                        description: 'Сделать другое',
                        period: '2026-09',
                        isRecurring: false,
                        dueDate: '2026-09-15',
                        rewardAmount: 5000,
                    },
                });

                const payPerHourRule = PayPerHoursEntity.create({
                    type: 'PayPerHour',
                    name: 'Почасовая ставка',
                    targetRole: 'ENGINEER',
                    config: { price: 300 },
                });

                return MotivationSchema.create({
                    targetType: 'Employee',
                    targetId: 42,
                    name: 'Личная мотивация',
                    rules: [archivedRule, activeTaskRule, payPerHourRule],
                });
            });

        it('toListItemResponse исключает ARCHIVED-правило из ruleCount/ruleTypes', () => {
            const schema = buildSchemaWithRules();

            const response = mapper.toListItemResponse(schema, 'Олег Фадеев');

            expect(response.ruleCount).toBe(2);
            expect(response.ruleTypes).toEqual(['TaskCompleted', 'PayPerHour']);
        });

        it('toDetailResponse исключает ARCHIVED-правило из rules[]', () => {
            const schema = buildSchemaWithRules();

            const response = mapper.toDetailResponse(schema, 'Олег Фадеев');

            expect(response.rules).toHaveLength(2);
            expect(response.rules.map((rule) => rule.name)).toEqual([
                'Активная задача',
                'Почасовая ставка',
            ]);
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
                    serviceName: 'Оклад',
                });
                expect(record).not.toHaveProperty('rules');
            });
        });
    });
});
