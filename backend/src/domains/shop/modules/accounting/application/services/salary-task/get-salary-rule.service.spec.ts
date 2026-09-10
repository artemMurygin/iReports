import { withRequestContext } from '@/shared/testing/with-request-context';
import { GetSalaryRuleService } from './get-salary-rule.service';
import { ShopSalaryRuleNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/salary-rule.exception';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';

// Раздел 18 tasks.md (add-task-salary-rule-links-comments) — зеркало
// domains/service/.../get-salary-rule.service.spec.ts. spec:
// shop/accounting#requirement-зарплатное-правило-доступно-для-получения-по-собственному-идентификатору
describe('GetSalaryRuleService (shop)', () => {
    const buildRule = () =>
        PayPerHourShopEntity.create({
            type: 'PayPerHour',
            name: 'Почасовая',
            targetRole: 'OFFLINE_MANAGER',
            config: { price: 100 },
        });

    const buildService = (options: {
        rule?: ReturnType<typeof buildRule> | null;
        motivationSchemaId?: string | null;
        schema?: ShopMotivationSchema | null;
    }) => {
        const findById = jest.fn().mockResolvedValue(options.rule ?? null);
        const findMotivationSchemaId = jest
            .fn()
            .mockResolvedValue(options.motivationSchemaId ?? null);
        const salaryRuleRepo = {
            findById,
            findMotivationSchemaId,
        } as unknown as ShopSalaryRuleRepositoryPort;

        const findSchemaById = jest
            .fn()
            .mockResolvedValue(options.schema ?? null);
        const motivationSchemaRepo = {
            findById: findSchemaById,
        } as unknown as ShopMotivationSchemaRepositoryPort;

        return {
            service: new GetSalaryRuleService(
                salaryRuleRepo,
                motivationSchemaRepo,
            ),
            findById,
            findMotivationSchemaId,
            findSchemaById,
        };
    };

    it('возвращает ShopSalaryRuleDetail с названием мотивационной схемы', async () => {
        await withRequestContext(async () => {
            const rule = buildRule();
            const schema = ShopMotivationSchema.create({
                targetType: 'Employee',
                targetId: 42,
                name: 'Менеджеры',
                rules: [],
            });
            const { service } = buildService({
                rule,
                motivationSchemaId: schema.id,
                schema,
            });

            const detail = await service.execute(rule.id);

            expect(detail).toEqual({
                id: rule.id,
                type: 'PayPerHour',
                name: 'Почасовая',
                targetRole: 'OFFLINE_MANAGER',
                direction: 'shop',
                config: { price: 100 },
                motivationSchemaName: 'Менеджеры',
            });
        });
    });

    it('бросает ShopSalaryRuleNotFoundException для несуществующего id', async () => {
        await withRequestContext(async () => {
            const { service } = buildService({ rule: null });

            await expect(service.execute('missing-id')).rejects.toThrow(
                ShopSalaryRuleNotFoundException,
            );
        });
    });
});
