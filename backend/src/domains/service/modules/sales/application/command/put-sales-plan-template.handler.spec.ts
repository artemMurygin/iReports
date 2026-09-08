import { withRequestContext } from '@/shared/testing/with-request-context';
import { PutSalesPlanTemplateHandler } from './put-sales-plan-template.handler';
import { PutSalesPlanTemplateCommand } from './put-sales-plan-template.command';
import type { SalesPlanTemplateRepositoryPort } from '../ports/sales-plan-template.port';
import { SalesPlanTemplate } from '../../domain/entities/sales-plan-template.entity';

describe('PutSalesPlanTemplateHandler', () => {
    const buildHandler = (existing: SalesPlanTemplate | null) => {
        const insert = jest.fn().mockResolvedValue(undefined);
        const update = jest.fn().mockResolvedValue(undefined);
        const findByScope = jest.fn().mockResolvedValue(existing);
        const repo: SalesPlanTemplateRepositoryPort = {
            insert,
            update,
            findByScope,
            findAll: jest.fn(),
        };
        const handler = new PutSalesPlanTemplateHandler(repo);
        return { handler, insert, update };
    };

    const buildCommand = () =>
        new PutSalesPlanTemplateCommand({
            direction: 'service',
            department: 1,
            turnover: 1_000_000,
            margin: 200_000,
            growthPercent: 10,
        });

    it('создаёт строку шаблона, если её ещё нет', async () => {
        await withRequestContext(async () => {
            const { handler, insert, update } = buildHandler(null);

            const result = await handler.execute(buildCommand());

            expect(insert).toHaveBeenCalledTimes(1);
            expect(update).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                direction: 'service',
                department: 1,
                category: null,
                growthPercent: 10,
            });
        });
    });

    it('правит существующую строку шаблона вместо создания новой', async () => {
        await withRequestContext(async () => {
            const existing = SalesPlanTemplate.create({
                direction: 'service',
                department: 1,
                turnover: 500_000,
                margin: 100_000,
            });
            const { handler, insert, update } = buildHandler(existing);

            const result = await handler.execute(
                new PutSalesPlanTemplateCommand({
                    direction: 'service',
                    department: 1,
                    turnover: 1_000_000,
                    margin: 200_000,
                    growthPercent: 15,
                }),
            );

            expect(insert).not.toHaveBeenCalled();
            expect(update).toHaveBeenCalledTimes(1);
            expect(result.turnover).toBe(1_000_000);
            expect(result.growthPercent).toBe(15);
        });
    });
});
