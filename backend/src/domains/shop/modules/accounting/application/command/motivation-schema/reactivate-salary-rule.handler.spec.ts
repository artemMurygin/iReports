import { withRequestContext } from '@/shared/testing/with-request-context';
import { ReactivateShopSalaryRuleHandler } from './reactivate-salary-rule.handler';
import { ReactivateShopSalaryRuleCommand } from './reactivate-salary-rule.command';
import { ShopSalaryRuleNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/salary-rule.exception';
import type { ShopSalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

// Зеркало domains/service/.../reactivate-salary-rule.handler.spec.ts —
// независимая копия для направления shop.
describe('ReactivateShopSalaryRuleHandler', () => {
    const buildRule = () => {
        const activateMock = jest.fn(function (this: { isActive: boolean }) {
            this.isActive = true;
        });
        const rule: ShopSalaryRule = {
            id: 'rule-1',
            name: 'Процент от выручки',
            type: 'ProductSold',
            targetRole: 'ONLINE_MANAGER',
            config: {
                award: { type: 'Fixed', price: 100 },
            } as unknown as ShopSalaryRule['config'],
            updatedAt: new Date('2026-09-01T00:00:00.000Z'),
            isActive: false,
            calculate: () => null,
            deactivate: jest.fn(function (this: { isActive: boolean }) {
                this.isActive = false;
            }),
            activate: activateMock,
        };

        return { rule, activateMock };
    };

    const buildHandler = (rule: ShopSalaryRule | null) => {
        const update = jest.fn().mockResolvedValue(undefined);
        const shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteByIds: jest.fn(),
            findById: jest.fn().mockResolvedValue(rule),
            update,
            findByTaskId: jest.fn().mockResolvedValue(null),
            findMotivationSchemaId: jest.fn().mockResolvedValue(null),
        };

        const run = jest.fn((work: () => Promise<unknown>) => work());
        const unitOfWork: UnitOfWorkPort = {
            run: run as UnitOfWorkPort['run'],
        };

        const handler = new ReactivateShopSalaryRuleHandler(
            shopSalaryRuleRepo,
            unitOfWork,
        );

        return { handler, update };
    };

    it('реактивирует правило и персистит его', async () => {
        await withRequestContext(async () => {
            const { rule, activateMock } = buildRule();
            const { handler, update } = buildHandler(rule);

            await handler.execute(
                new ReactivateShopSalaryRuleCommand({ ruleId: 'rule-1' }),
            );

            expect(activateMock).toHaveBeenCalledTimes(1);
            expect(update).toHaveBeenCalledWith(rule);
        });
    });

    it('бросает ShopSalaryRuleNotFoundException для несуществующего правила и ничего не пишет', async () => {
        await withRequestContext(async () => {
            const { handler, update } = buildHandler(null);

            await expect(
                handler.execute(
                    new ReactivateShopSalaryRuleCommand({ ruleId: 'missing' }),
                ),
            ).rejects.toThrow(ShopSalaryRuleNotFoundException);
            expect(update).not.toHaveBeenCalled();
        });
    });
});
