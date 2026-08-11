import { PeriodCalculationOrchestrator } from './period-calculation.orchestrator';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';

// Часы сотрудника за период — одно значение из ручного ввода (Фаза 7),
// общее для всех правил его схемы вне зависимости от роли; независимость
// правил демонстрируется разными ставками (price), а не разными часами.
const buildContext = (hoursWorked = 5): CalculationContext => ({
    employee: { id: 1, identities: [] },
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
        hoursWorked,
    } satisfies ServiceCalculationErpData,
    salesPerformance: null,
});

describe('PeriodCalculationOrchestrator', () => {
    it('собирает контекст один раз и передаёт его во все правила схемы сотрудника', async () => {
        const ruleA = PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Часы (инженер)',
            targetRole: 'ENGINEER',
            config: { price: 300 },
        });
        const ruleB = PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Часы (онлайн-менеджер)',
            targetRole: 'ONLINE_MANAGER',
            config: { price: 250 },
        });
        const context = buildContext();
        const calculateA = jest.spyOn(ruleA, 'calculate');
        const calculateB = jest.spyOn(ruleB, 'calculate');

        const lines = await PeriodCalculationOrchestrator.calculate(
            [ruleA, ruleB],
            context,
        );

        expect(calculateA).toHaveBeenCalledWith(context);
        expect(calculateB).toHaveBeenCalledWith(context);
        expect(lines).toHaveLength(2);
    });

    it('итог по сотруднику — сумма строк расчёта, без ветвлений по ролям/типам', async () => {
        const rules = [
            PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Часы (инженер)',
                targetRole: 'ENGINEER',
                config: { price: 300 }, // 5 * 300 = 1500
            }),
            PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Часы (онлайн-менеджер)',
                targetRole: 'ONLINE_MANAGER',
                config: { price: 250 }, // 5 * 250 = 1250
            }),
        ];

        const lines = await PeriodCalculationOrchestrator.calculate(
            rules,
            buildContext(),
        );

        expect(PeriodCalculationOrchestrator.total(lines)).toBe(2750);
    });

    it('для пустого набора правил возвращает пустой список строк и нулевой итог', async () => {
        const lines = await PeriodCalculationOrchestrator.calculate(
            [],
            buildContext(),
        );

        expect(lines).toEqual([]);
        expect(PeriodCalculationOrchestrator.total(lines)).toBe(0);
    });
});
