import { withRequestContext } from '@/shared/testing/with-request-context';
import { GetSalaryRuleService } from './get-salary-rule.service';
import { SalaryRuleNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-rule.exception';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';

// Раздел 18 tasks.md (add-task-salary-rule-links-comments) — тонкая
// read-обёртка над уже существующим SalaryRuleRepositoryPort.findById для
// боковой панели правила (features/SalaryRuleDetailsPanel). spec:
// service/accounting#requirement-зарплатное-правило-доступно-для-получения-по-собственному-идентификатору
describe('GetSalaryRuleService', () => {
    const buildRule = () =>
        PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Почасовая',
            targetRole: 'ENGINEER',
            config: { price: 100 },
        });

    const buildService = (options: {
        rule?: ReturnType<typeof buildRule> | null;
        motivationSchemaId?: string | null;
        schema?: MotivationSchema | null;
    }) => {
        const findById = jest.fn().mockResolvedValue(options.rule ?? null);
        const findMotivationSchemaId = jest
            .fn()
            .mockResolvedValue(options.motivationSchemaId ?? null);
        const salaryRuleRepo = {
            findById,
            findMotivationSchemaId,
        } as unknown as SalaryRuleRepositoryPort;

        const findSchemaById = jest
            .fn()
            .mockResolvedValue(options.schema ?? null);
        const motivationSchemaRepo = {
            findById: findSchemaById,
        } as unknown as MotivationSchemaRepositoryPort;

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

    it('возвращает SalaryRuleDetail с названием мотивационной схемы', async () => {
        await withRequestContext(async () => {
            const rule = buildRule();
            const schema = MotivationSchema.create({
                targetType: 'Employee',
                targetId: 42,
                name: 'Инженеры',
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
                targetRole: 'ENGINEER',
                direction: 'service',
                config: { price: 100 },
                motivationSchemaName: 'Инженеры',
            });
        });
    });

    it('бросает SalaryRuleNotFoundException для несуществующего id', async () => {
        await withRequestContext(async () => {
            const { service } = buildService({ rule: null });

            await expect(service.execute('missing-id')).rejects.toThrow(
                SalaryRuleNotFoundException,
            );
        });
    });
});
