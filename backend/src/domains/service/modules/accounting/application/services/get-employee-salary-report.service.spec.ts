import { GetEmployeeSalaryReportService } from './get-employee-salary-report.service';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('GetEmployeeSalaryReportService', () => {
    const buildService = (schema: MotivationSchema | null) => {
        const findByEmployee = jest
            .fn<Promise<MotivationSchema | null>, [number]>()
            .mockResolvedValue(schema);
        const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee,
        };
        const service = new GetEmployeeSalaryReportService(
            motivationSchemaRepo,
        );
        return { service, findByEmployee };
    };

    it('отклоняет период не в формате YYYY-MM', async () => {
        await withRequestContext(async () => {
            const { service } = buildService(null);

            await expect(service.execute(1, '2026/08')).rejects.toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('возвращает пустой отчёт, если у сотрудника нет мотивационной схемы', async () => {
        const { service, findByEmployee } = buildService(null);

        const report = await service.execute(1, '2026-08');

        expect(findByEmployee).toHaveBeenCalledWith(1);
        expect(report).toEqual({
            period: '2026-08',
            isClosed: false,
            directions: [
                {
                    direction: 'service',
                    total: { fact: 0, prognose: 0 },
                    rules: [],
                    salesPerformance: null,
                    isPlanApproved: true,
                },
            ],
            grandTotal: { fact: 0, prognose: 0 },
        });
    });

    it('возвращает итог и разбивку по правилам схемы для запроса с PayPerHour', async () => {
        const schema = withRequestContext(() => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { hours: 8, price: 250 },
            });
            return MotivationSchema.create({
                targetType: 'Employee',
                targetId: 42,
                name: 'Оклад инженера',
                rules: [rule],
            });
        });
        const { service } = buildService(schema);

        const report = await service.execute(42, '2026-08');

        expect(report.grandTotal).toEqual({ fact: 2000, prognose: 2000 });
        expect(report.directions).toHaveLength(1);
        const [direction] = report.directions;
        expect(direction.direction).toBe('service');
        expect(direction.total).toEqual({ fact: 2000, prognose: 2000 });
        expect(direction.rules).toHaveLength(1);
        expect(direction.rules[0]).toMatchObject({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ENGINEER',
            amount: { fact: 2000, prognose: 2000 },
        });
    });
});
