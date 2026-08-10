import { ServiceCompletedEntity } from './service-completed.entity';

describe('ServiceCompletedEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом ServiceCompleted', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                config: { award: { type: 'Fixed', price: 100 } },
            });

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('ServiceCompleted');
            expect(rule.name).toBe('За выполненную услугу');
            expect(rule.config).toEqual({
                award: { type: 'Fixed', price: 100 },
            });
        });
    });

    describe('calculate', () => {
        // TODO: сейчас расчёт захардкожен и не учитывает config.award —
        // тест фиксирует текущее поведение, а не то, каким оно должно быть.
        it('возвращает фиксированное значение независимо от config', () => {
            const rule = ServiceCompletedEntity.create({
                type: 'ServiceCompleted',
                name: 'За выполненную услугу',
                config: { award: { type: 'ServicePercent', percent: 15 } },
            });

            expect(rule.calculate()).toBe(10);
        });
    });
});
