import { resolveFloatPercentMultiplier } from './float-percent';
import type { PercentBorder } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';

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

describe('resolveFloatPercentMultiplier (shop, независимая реализация)', () => {
    describe('FIX', () => {
        it('ниже первого порога — множитель 0', () => {
            expect(resolveFloatPercentMultiplier(borders, 10)).toBe(0);
        });

        it('на пороге и между порогами — множитель ступенькой', () => {
            expect(resolveFloatPercentMultiplier(borders, 50)).toBe(0.5);
            expect(resolveFloatPercentMultiplier(borders, 65)).toBe(0.5);
            expect(resolveFloatPercentMultiplier(borders, 70)).toBe(1);
            expect(resolveFloatPercentMultiplier(borders, 99)).toBe(1);
        });

        it('на и выше старшего порога — множитель фиксируется', () => {
            expect(resolveFloatPercentMultiplier(borders, 100)).toBe(1.5);
            expect(resolveFloatPercentMultiplier(borders, 200)).toBe(1.5);
        });
    });

    describe('LINEAR', () => {
        it('ниже первого порога — множитель 0 (правило ещё не действует)', () => {
            expect(resolveFloatPercentMultiplier(linearBorders, 25)).toBe(0);
        });

        it('между порогами — линейная интерполяция от ЭТОГО порога к СЛЕДУЮЩЕМУ', () => {
            expect(
                resolveFloatPercentMultiplier(linearBorders, 60),
            ).toBeCloseTo(0.75);
        });

        it('на и выше старшего порога — множитель фиксируется', () => {
            expect(resolveFloatPercentMultiplier(linearBorders, 100)).toBe(1.5);
            expect(resolveFloatPercentMultiplier(linearBorders, 200)).toBe(1.5);
        });
    });

    // Смешанный режим — зеркало теста сервиса
    // (domains/service/.../float-percent.spec.ts): mode лежит на пороге,
    // задающем НИЖНЮЮ границу отрезка, и описывает, что происходит ПОСЛЕ
    // него.
    describe('смешанный режим (FIX + LINEAR на разных порогах)', () => {
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

        it('0-70% — плоско на множителе нижнего порога', () => {
            expect(resolveFloatPercentMultiplier(mixedBorders, 30)).toBe(0.5);
        });

        it('70-120% — линейно от 0.7 до 1.2', () => {
            expect(resolveFloatPercentMultiplier(mixedBorders, 85)).toBeCloseTo(
                0.85,
            );
        });

        it('от 120% и выше — плоско на 1.2', () => {
            expect(resolveFloatPercentMultiplier(mixedBorders, 150)).toBe(1.2);
        });
    });
});
