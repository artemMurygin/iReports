import { PayPerHoursEntity } from './pay-per-hour.entity';

describe('PayPerHoursEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом PayPerHour', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                config: { hours: 10, price: 300 },
            });

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('PayPerHour');
            expect(rule.name).toBe('Почасовая ставка');
            expect(rule.config).toEqual({ hours: 10, price: 300 });
        });
    });

    describe('calculate', () => {
        it('умножает часы на ставку', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                config: { hours: 8, price: 250 },
            });

            expect(rule.calculate()).toBe(2000);
        });

        it('возвращает 0 при отсутствии часов', () => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                config: { price: 250 },
            });

            expect(rule.calculate()).toBe(0);
        });
    });
});
