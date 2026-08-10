import { ServiceCompletedEntity } from './service-completed.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';

const buildContext = (): CalculationContext => ({
    employee: { id: 1, identities: [] },
    period: {
        direction: 'service',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode: 'FACT',
    erpData: undefined,
    salesPerformance: null,
});

describe('ServiceCompletedEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом ServiceCompleted', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 100 } },
            });

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('ServiceCompleted');
            expect(rule.name).toBe('За выполненную услугу');
            expect(rule.targetRole).toBe('ENGINEER');
            expect(rule.config).toEqual({
                award: { type: 'Fixed', price: 100 },
            });
        });
    });

    describe('calculate', () => {
        // TODO: сейчас расчёт захардкожен и не учитывает config.award —
        // тест фиксирует текущее поведение, а не то, каким оно должно быть
        // (см. Фазу 7 плана).
        it('возвращает строку расчёта с фиксированной суммой независимо от config', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'ServicePercent', percent: 15 } },
            });

            expect(rule.calculate(buildContext())).toEqual({
                ruleId: rule.id,
                amount: 10,
                sources: [],
            });
        });
    });
});
