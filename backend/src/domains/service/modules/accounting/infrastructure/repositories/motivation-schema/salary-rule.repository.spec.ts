import { SalaryRuleRepository } from './salary-rule.repository';
import { SalaryRuleMapper } from '../../mappers/motivation-schema/salary-rule.mapper';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import { Period } from '@/shared/domain/period.value-object';
import type { TaskCompletionSalaryConfig } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Тесты findByTaskId/findMotivationSchemaId, добавленных
// SalaryRuleRepositoryPort разделами 15/18 tasks.md
// (add-task-salary-rule-links-comments). insert/deleteByIds/findById/update
// этого репозитория тестами пока не покрыты — новые read-методы получают
// собственное покрытие здесь (тот же приём, что и у
// shop/.../salary-rule.repository.spec.ts, findById которого уже был
// покрыт раньше, вне этого change).
describe('SalaryRuleRepository', () => {
    const currentPeriod = Period.current().getValue();

    const buildTaskCompletionRecord = (
        overrides: Record<string, unknown> = {},
    ) => ({
        id: 'rule-1',
        motivationSchemaId: 'schema-1',
        type: 'TaskCompletion',
        name: 'Собрать отчёт',
        targetRole: 'ENGINEER',
        direction: 'service',
        props: {
            taskIdByPeriod: { [currentPeriod]: 'task-1' },
            taskTitleTemplate: 'Собрать отчёт по продажам',
            taskDescriptionTemplate: 'Описание задачи',
            isRecurring: true,
            deadlineTemplate: '2026-01-25T18:00:00.000Z',
            defaultAmount: 5000,
        },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides,
    });

    const buildRepository = () => {
        const findMany = jest.fn();
        const findFirst = jest.fn();
        const client = {
            salaryRule: { findMany, findFirst },
        };
        const db = {
            getClient: () => client,
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        const repository = new SalaryRuleRepository(db);
        return { repository, findMany, findFirst };
    };

    describe('findByTaskId', () => {
        // spec: service/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
        it('находит правило TaskCompletion, ссылающееся на taskId в текущем периоде', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildTaskCompletionRecord({
                    id: 'rule-other',
                    props: {
                        taskIdByPeriod: { [currentPeriod]: 'task-other' },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: false,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
                buildTaskCompletionRecord(),
            ]);

            const rule = await repository.findByTaskId('task-1');

            expect(findMany).toHaveBeenCalledWith({
                where: { type: 'TaskCompletion', direction: 'service' },
            });
            expect(rule).not.toBeNull();
            expect(rule?.id).toBe('rule-1');
        });

        it('возвращает null, если ни одно правило не ссылается на taskId в текущем периоде', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: { [currentPeriod]: 'other-task' },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: false,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
            ]);

            const rule = await repository.findByTaskId('task-1');

            expect(rule).toBeNull();
        });

        it('игнорирует ссылку правила на taskId за ПРОШЛЫЙ период', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: { '2020-01': 'task-1' },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: true,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
            ]);

            const rule = await repository.findByTaskId('task-1');

            expect(rule).toBeNull();
        });
    });

    // deactivate-one-off-task-completion-rule, design.md решение 3 — в
    // отличие от findByTaskId выше, сканирует ЛЮБОЙ период
    // taskIdByPeriod (не только текущий) и возвращает правило только если
    // оно разовое (isRecurring: false); direction: 'service' фиксируется в
    // самом WHERE-запросе (тем же приёмом, что и у findByTaskId), поэтому
    // правило чужого направления physически не попадёт в findMany.
    describe('findOneOffByAnyTaskId', () => {
        it('находит разовое правило TaskCompletion, ссылающееся на taskId в ПРОШЛОМ периоде', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: { '2020-01': 'task-1' },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: false,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
            ]);

            const rule = await repository.findOneOffByAnyTaskId('task-1');

            expect(findMany).toHaveBeenCalledWith({
                where: { type: 'TaskCompletion', direction: 'service' },
            });
            expect(rule).not.toBeNull();
            expect(rule?.id).toBe('rule-1');
        });

        it('находит разовое правило, ссылающееся на taskId в ТЕКУЩЕМ периоде', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: { [currentPeriod]: 'task-1' },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: false,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
            ]);

            const rule = await repository.findOneOffByAnyTaskId('task-1');

            expect(rule).not.toBeNull();
            expect(rule?.id).toBe('rule-1');
        });

        it('возвращает null, если найденное правило регулярное (isRecurring: true)', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: { [currentPeriod]: 'task-1' },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: true,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
            ]);

            const rule = await repository.findOneOffByAnyTaskId('task-1');

            expect(rule).toBeNull();
        });

        it('возвращает null, если ни одно правило домена не ссылается на taskId ни в одном периоде', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: { [currentPeriod]: 'other-task' },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: false,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
            ]);

            const rule = await repository.findOneOffByAnyTaskId('task-1');

            expect(rule).toBeNull();
        });

        it('запрашивает только правила направления service — правило другого направления не может быть найдено', async () => {
            // Правило направления shop с тем же taskId физически не попадёт
            // в результат findMany, т.к. Prisma-запрос уже фильтрует
            // direction: 'service' в WHERE — findMany здесь возвращает
            // пустой список, эмулируя ситуацию "совпадение есть, но только
            // у чужого направления".
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            const rule = await repository.findOneOffByAnyTaskId('task-1');

            expect(findMany).toHaveBeenCalledWith({
                where: { type: 'TaskCompletion', direction: 'service' },
            });
            expect(rule).toBeNull();
        });
    });

    // add-task-salary-rule-accounting-period, design.md Decision 1 —
    // SalaryRuleMapper.toDomain дерива́т accountingPeriod для уже
    // персистированных строк, у которых его нет в props (создано до этой
    // фичи): из максимального (лексикографически, формат YYYY-MM) ключа
    // taskIdByPeriod, а если карта тоже пуста — Period.current().
    describe('SalaryRuleMapper.toDomain — деривация accountingPeriod', () => {
        const mapper = new SalaryRuleMapper();

        it('дериви́рует accountingPeriod из максимального ключа taskIdByPeriod, если поле отсутствует в props', () => {
            const rule = mapper.toDomain(
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: {
                            '2026-01': 'task-a',
                            '2026-03': 'task-b',
                            '2025-12': 'task-c',
                        },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: true,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
            );

            expect(
                (rule.config as TaskCompletionSalaryConfig).accountingPeriod,
            ).toBe('2026-03');
        });

        it('дериви́рует Period.current(), если и accountingPeriod, и taskIdByPeriod отсутствуют/пусты', () => {
            const rule = mapper.toDomain(
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: {},
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: false,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
            );

            expect(
                (rule.config as TaskCompletionSalaryConfig).accountingPeriod,
            ).toBe(Period.current().getValue());
        });

        it('передаёт уже заполненный в props accountingPeriod как есть, не переопределяя его', () => {
            const rule = mapper.toDomain(
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: {
                            '2026-01': 'task-a',
                            '2026-05': 'task-b',
                        },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: true,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                        accountingPeriod: '2026-01',
                    },
                }),
            );

            expect(
                (rule.config as TaskCompletionSalaryConfig).accountingPeriod,
            ).toBe('2026-01');
        });
    });

    // recurring-task-deadline-offset, tasks.md 4.1 — обратная совместимость с легаси-строками
    // (созданными до этой фичи, без deadlinePeriodOffset в props): тот же приём, что и у
    // accountingPeriod выше — деривация значения по умолчанию на границе SalaryRuleMapper.toDomain,
    // а не бэкфилл БД.
    describe('SalaryRuleMapper.toDomain — деривация deadlinePeriodOffset', () => {
        const mapper = new SalaryRuleMapper();

        it('легаси-запись без deadlinePeriodOffset в props получает deadlinePeriodOffset = 0', () => {
            const rule = mapper.toDomain(
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: { [currentPeriod]: 'task-1' },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: true,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                    },
                }),
            );

            expect(
                (rule.config as TaskCompletionSalaryConfig)
                    .deadlinePeriodOffset,
            ).toBe(0);
        });

        it('запись с явным deadlinePeriodOffset сохраняет своё значение', () => {
            const rule = mapper.toDomain(
                buildTaskCompletionRecord({
                    props: {
                        taskIdByPeriod: { [currentPeriod]: 'task-1' },
                        taskTitleTemplate: 'Шаблон',
                        isRecurring: true,
                        deadlineTemplate: '2026-01-25T18:00:00.000Z',
                        defaultAmount: 1000,
                        deadlinePeriodOffset: 2,
                    },
                }),
            );

            expect(
                (rule.config as TaskCompletionSalaryConfig)
                    .deadlinePeriodOffset,
            ).toBe(2);
        });
    });

    describe('findMotivationSchemaId', () => {
        it('возвращает motivationSchemaId найденного правила направления service', async () => {
            const { repository, findFirst } = buildRepository();
            findFirst.mockResolvedValueOnce({ motivationSchemaId: 'schema-1' });

            const id = await repository.findMotivationSchemaId('rule-1');

            expect(findFirst).toHaveBeenCalledWith({
                where: { id: 'rule-1', direction: 'service' },
                select: { motivationSchemaId: true },
            });
            expect(id).toBe('schema-1');
        });

        it('возвращает null, если правило не найдено', async () => {
            const { repository, findFirst } = buildRepository();
            findFirst.mockResolvedValueOnce(null);

            const id = await repository.findMotivationSchemaId('rule-unknown');

            expect(id).toBeNull();
        });
    });
});
