import { withRequestContext } from '@/shared/testing/with-request-context';
import { DeactivateSalaryRuleHandler } from './deactivate-salary-rule.handler';
import { DeactivateSalaryRuleCommand } from './deactivate-salary-rule.command';
import { SalaryRuleNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-rule.exception';
import type { SalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';

describe('DeactivateSalaryRuleHandler', () => {
    const buildHandler = (rule: PayPerHoursEntity | null) => {
        const update = jest
            .fn<Promise<void>, [PayPerHoursEntity]>()
            .mockResolvedValue(undefined);
        const salaryRuleRepo: SalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteByIds: jest.fn(),
            findById: jest.fn().mockResolvedValue(rule),
            update: update as SalaryRuleRepositoryPort['update'],
            findByTaskId: jest.fn().mockResolvedValue(null),
            findMotivationSchemaId: jest.fn().mockResolvedValue(null),
        };

        const run = jest.fn((work: () => Promise<unknown>) => work());
        const unitOfWork: UnitOfWorkPort = {
            run: run as UnitOfWorkPort['run'],
        };

        const handler = new DeactivateSalaryRuleHandler(
            salaryRuleRepo,
            unitOfWork,
        );

        return { handler, update, run };
    };

    it('деактивирует найденное правило и персистит его через update', async () => {
        await withRequestContext(async () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'ENGINEER',
                config: { price: 100 },
            });
            const { handler, update } = buildHandler(rule);

            await handler.execute(
                new DeactivateSalaryRuleCommand({ ruleId: rule.id }),
            );

            expect(rule.isActive).toBe(false);
            expect(update).toHaveBeenCalledWith(rule);
        });
    });

    it('бросает SalaryRuleNotFoundException для несуществующего правила и ничего не пишет', async () => {
        await withRequestContext(async () => {
            const { handler, update } = buildHandler(null);

            await expect(
                handler.execute(
                    new DeactivateSalaryRuleCommand({ ruleId: 'missing' }),
                ),
            ).rejects.toThrow(SalaryRuleNotFoundException);
            expect(update).not.toHaveBeenCalled();
        });
    });
});
