import { FloatPercentSchedule } from './float-percent-schedule.value-object';
import type { PercentBorder } from 'ireports-contracts';

const borders: [PercentBorder, PercentBorder, PercentBorder] = [
    { name: 'A', fromPlanPercent: 50, multiplier: 0.5, mode: 'FIX' },
    { name: 'B', fromPlanPercent: 70, multiplier: 1, mode: 'FIX' },
    { name: 'C', fromPlanPercent: 100, multiplier: 1.5, mode: 'FIX' },
];

const linearBorders: [PercentBorder, PercentBorder, PercentBorder] = [
    { name: 'A', fromPlanPercent: 50, multiplier: 0.5, mode: 'LINEAR' },
    { name: 'B', fromPlanPercent: 70, multiplier: 1, mode: 'LINEAR' },
    { name: 'C', fromPlanPercent: 100, multiplier: 1.5, mode: 'LINEAR' },
];

describe('FloatPercentSchedule', () => {
    describe('create — валидация инвариантов', () => {
        it('бросает на пустом названии порога', () => {
            expect(() =>
                FloatPercentSchedule.create([
                    {
                        name: '  ',
                        fromPlanPercent: 0,
                        multiplier: 1,
                        mode: 'FIX',
                    },
                    borders[1],
                    borders[2],
                ]),
            ).toThrow();
        });

        it('бросает на отрицательном fromPlanPercent', () => {
            expect(() =>
                FloatPercentSchedule.create([
                    {
                        name: 'A',
                        fromPlanPercent: -10,
                        multiplier: 1,
                        mode: 'FIX',
                    },
                    borders[1],
                    borders[2],
                ]),
            ).toThrow();
        });

        it('бросает на отрицательном multiplier', () => {
            expect(() =>
                FloatPercentSchedule.create([
                    {
                        name: 'A',
                        fromPlanPercent: 0,
                        multiplier: -1,
                        mode: 'FIX',
                    },
                    borders[1],
                    borders[2],
                ]),
            ).toThrow();
        });

        it('бросает на повторяющемся fromPlanPercent (пороги не уникальны)', () => {
            expect(() =>
                FloatPercentSchedule.create([
                    {
                        name: 'A',
                        fromPlanPercent: 50,
                        multiplier: 0.5,
                        mode: 'FIX',
                    },
                    {
                        name: 'B',
                        fromPlanPercent: 50,
                        multiplier: 1,
                        mode: 'FIX',
                    },
                    borders[2],
                ]),
            ).toThrow();
        });

        it('бросает, если пороги идут не по возрастанию', () => {
            expect(() =>
                FloatPercentSchedule.create([
                    borders[0],
                    {
                        name: 'B',
                        fromPlanPercent: 60,
                        multiplier: 1,
                        mode: 'FIX',
                    },
                    {
                        name: 'C',
                        fromPlanPercent: 55,
                        multiplier: 1.5,
                        mode: 'FIX',
                    },
                ]),
            ).toThrow();
        });

        it('не бросает на валидных возрастающих порогах', () => {
            expect(() => FloatPercentSchedule.create(borders)).not.toThrow();
        });
    });

    describe('resolveMultiplier — FIX', () => {
        const schedule = FloatPercentSchedule.create(borders);

        it('ниже первого порога — множитель 0', () => {
            expect(schedule.resolveMultiplier(10)).toBe(0);
        });

        it('на пороге и между порогами — множитель ступенькой', () => {
            expect(schedule.resolveMultiplier(50)).toBe(0.5);
            expect(schedule.resolveMultiplier(65)).toBe(0.5);
            expect(schedule.resolveMultiplier(70)).toBe(1);
            expect(schedule.resolveMultiplier(99)).toBe(1);
        });

        it('на и выше старшего порога — множитель фиксируется', () => {
            expect(schedule.resolveMultiplier(100)).toBe(1.5);
            expect(schedule.resolveMultiplier(200)).toBe(1.5);
        });
    });

    describe('resolveMultiplier — LINEAR', () => {
        const schedule = FloatPercentSchedule.create(linearBorders);

        it('ниже первого порога — множитель 0 (правило ещё не действует)', () => {
            expect(schedule.resolveMultiplier(25)).toBe(0);
        });

        it('между порогами — линейная интерполяция от ЭТОГО порога к СЛЕДУЮЩЕМУ', () => {
            expect(schedule.resolveMultiplier(60)).toBeCloseTo(0.75);
        });

        it('на и выше старшего порога — множитель фиксируется', () => {
            expect(schedule.resolveMultiplier(100)).toBe(1.5);
            expect(schedule.resolveMultiplier(200)).toBe(1.5);
        });
    });

    describe('resolveMultiplier — смешанный режим (FIX + LINEAR на разных порогах)', () => {
        const mixedBorders: [PercentBorder, PercentBorder, PercentBorder] = [
            {
                name: 'Ниже плана',
                fromPlanPercent: 0,
                multiplier: 0.5,
                mode: 'FIX',
            },
            {
                name: 'Выполнение плана',
                fromPlanPercent: 70,
                multiplier: 0.7,
                mode: 'LINEAR',
            },
            {
                name: 'Перевыполнение',
                fromPlanPercent: 120,
                multiplier: 1.2,
                mode: 'FIX',
            },
        ];
        const schedule = FloatPercentSchedule.create(mixedBorders);

        it('0-70% — плоско на множителе нижнего порога', () => {
            expect(schedule.resolveMultiplier(30)).toBe(0.5);
        });

        it('70-120% — линейно от 0.7 до 1.2', () => {
            expect(schedule.resolveMultiplier(85)).toBeCloseTo(0.85);
        });

        it('от 120% и выше — плоско на 1.2', () => {
            expect(schedule.resolveMultiplier(150)).toBe(1.2);
        });
    });

    describe('buildThresholdInfo', () => {
        const schedule = FloatPercentSchedule.create(borders);

        it('отдаёт текущий/следующий порог и разницу в обороте до следующего', () => {
            const info = schedule.buildThresholdInfo(60, 100_000, 60_000);
            expect(info.currentThreshold?.name).toBe('A');
            expect(info.nextThreshold?.name).toBe('B');
            expect(info.diffToNext).toBe(10_000);
        });

        it('nextThreshold null на и выше старшего порога', () => {
            const info = schedule.buildThresholdInfo(150, 100_000, 150_000);
            expect(info.nextThreshold).toBeNull();
            expect(info.diffToNext).toBeNull();
        });
    });
});
