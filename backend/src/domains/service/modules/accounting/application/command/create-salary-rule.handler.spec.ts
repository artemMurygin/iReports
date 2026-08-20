import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateSalaryRuleHandler } from './create-salary-rule.handler';
import { CreateSalaryRuleCommand } from './create-salary-rule.command';
import type { SalaryRuleRepositoryPort } from '../ports/salary-rule.port';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';

describe('CreateSalaryRuleHandler', () => {
    const buildHandler = () => {
        const insert = jest
            .fn<Promise<void>, [SalaryRule, { motivationSchemaId: string }]>()
            .mockResolvedValue(undefined);
        const salaryRuleRepo: SalaryRuleRepositoryPort = {
            insert,
            deleteAllByMotivationSchema: jest.fn().mockResolvedValue(undefined),
        };
        const handler = new CreateSalaryRuleHandler(salaryRuleRepo);
        return { handler, insert };
    };

    it('создаёт правило нужного типа через SalaryRuleFactory и сохраняет его', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler();
            const command = new CreateSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                rule: {
                    type: 'PayPerHour',
                    name: 'Часы',
                    targetRole: 'ENGINEER',
                    config: { price: 200 },
                },
            });

            await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(1);
            const [entity, meta] = insert.mock.calls[0];
            expect(entity).toBeInstanceOf(PayPerHoursEntity);
            expect(
                entity.calculate({
                    employee: { id: 1, identities: [] },
                    period: {
                        direction: 'service',
                        period: '2026-08',
                        from: new Date('2026-08-01T00:00:00.000Z'),
                        to: new Date('2026-08-31T23:59:59.999Z'),
                        status: 'OPEN',
                    },
                    mode: 'FACT',
                    erpData: { serviceCompletedItems: [], hoursWorked: 5 },
                    salesPerformance: null,
                }).amount,
            ).toBe(1000);
            expect(meta).toEqual({ motivationSchemaId: 'schema-1' });
        });
    });

    it('возвращает id созданного правила', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler();
            const command = new CreateSalaryRuleCommand({
                motivationSchemaId: 'schema-1',
                rule: {
                    type: 'ServiceCompleted',
                    name: 'Услуги',
                    targetRole: 'ENGINEER',
                    config: { award: { type: 'ServiceFixed' } },
                },
            });

            const result = await handler.execute(command);

            expect(result.id).toEqual(expect.any(String));
        });
    });
});
