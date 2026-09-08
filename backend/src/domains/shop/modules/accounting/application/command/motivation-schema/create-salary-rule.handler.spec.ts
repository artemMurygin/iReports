import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateShopSalaryRuleHandler } from './create-salary-rule.handler';
import { CreateShopSalaryRuleCommand } from './create-salary-rule.command';
import type { ShopSalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { TaskCompletionShop } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/task-completion.entity';

// openspec/changes/replace-bitrix-task-integration, design.md решение 4 —
// зеркало CreateSalaryRuleHandler направления service (issue #57 —
// независимая копия): CreateShopSalaryRuleHandler больше НЕ ходит ни в
// Bitrix24, ни в src/modules/tasks вообще (задача создаётся фронтом
// отдельным запросом POST /v1/tasks ДО этого запроса) — правило
// TaskCompletion идёт ТЕМ ЖЕ путём, что и остальные типы правил (просто
// insert(rule), taskId уже сохранён в config.taskIdByPeriod фабрикой
// TaskCompletionShop.create(), см. task-completion.entity.spec.ts).
describe('CreateShopSalaryRuleHandler', () => {
    const buildHandler = (overrides?: { insertImpl?: () => Promise<void> }) => {
        const insert = jest
            .fn<
                Promise<void>,
                [ShopSalaryRule, { motivationSchemaId: string }]
            >()
            .mockImplementation(
                overrides?.insertImpl ?? (() => Promise.resolve()),
            );
        const shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort = {
            insert,
            deleteByIds: jest.fn().mockResolvedValue(undefined),
            findById: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue(undefined),
        };

        const handler = new CreateShopSalaryRuleHandler(shopSalaryRuleRepo);
        return { handler, insert };
    };

    it('создаёт правило нужного типа через ShopSalaryRuleFactory и сохраняет его', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler();
            const command = new CreateShopSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                rule: {
                    type: 'PayPerHour',
                    name: 'Часы',
                    targetRole: 'OFFLINE_MANAGER',
                    config: { price: 200 },
                },
            });

            await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(1);
            const [entity, meta] = insert.mock.calls[0];
            expect(entity).toBeInstanceOf(PayPerHourShopEntity);
            expect(
                entity.calculate({
                    employee: { id: 1, identities: [] },
                    period: {
                        direction: 'shop',
                        period: '2026-08',
                        from: new Date('2026-08-01T00:00:00.000Z'),
                        to: new Date('2026-08-31T23:59:59.999Z'),
                        status: 'OPEN',
                    },
                    mode: 'FACT',
                    erpData: { hoursWorked: { fact: 5, prognose: 5 } },
                    salesPerformance: null,
                }).amount,
            ).toBe(1000);
            expect(meta).toEqual({ motivationSchemaId: 'schema-1' });
        });
    });

    it('возвращает id созданного правила', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler();
            const command = new CreateShopSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                rule: {
                    type: 'ProductSold',
                    name: 'Продажи',
                    targetRole: 'OFFLINE_MANAGER',
                    config: {
                        category: null,
                        award: { type: 'Fixed', price: 100 },
                    },
                },
            });

            const result = await handler.execute(command);

            expect(result.id).toEqual(expect.any(String));
        });
    });

    describe('правило TaskCompletion', () => {
        it('не обращается ни в Bitrix24, ни в tasks — просто сохраняет правило с уже переданным taskId', async () => {
            await withRequestContext(async () => {
                const { handler, insert } = buildHandler();
                const command = new CreateShopSalaryRuleCommand({
                    motivationSchemaId: 'schema-1',
                    rule: {
                        type: 'TaskCompletion',
                        name: 'Сдать отчёт',
                        targetRole: 'OFFLINE_MANAGER',
                        config: {
                            taskId: 'task-42',
                            taskTitleTemplate: 'Сдать отчёт по браку',
                            isRecurring: false,
                            deadlineTemplate: '2026-09-20T00:00:00.000Z',
                            defaultAmount: 5000,
                        },
                    },
                });

                const result = await handler.execute(command);

                expect(insert).toHaveBeenCalledTimes(1);
                const [entity, meta] = insert.mock.calls[0];
                expect(entity).toBeInstanceOf(TaskCompletionShop);
                expect(
                    Object.values(
                        (entity as TaskCompletionShop).config.taskIdByPeriod,
                    ),
                ).toEqual(['task-42']);
                expect(meta).toEqual({ motivationSchemaId: 'schema-1' });
                expect(result.id).toEqual(expect.any(String));
            });
        });
    });
});
