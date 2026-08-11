import { resolveFloatPercentMultiplier } from './float-percent';
import type { PercentBorder } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

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

describe('resolveFloatPercentMultiplier', () => {
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
        it('ниже первого порога — линейная интерполяция от (0, 0)', () => {
            expect(
                resolveFloatPercentMultiplier(linearBorders, 25),
            ).toBeCloseTo(0.25);
        });

        it('между порогами — линейная интерполяция', () => {
            expect(
                resolveFloatPercentMultiplier(linearBorders, 60),
            ).toBeCloseTo(0.75);
            expect(
                resolveFloatPercentMultiplier(linearBorders, 85),
            ).toBeCloseTo(1.25);
        });

        it('на и выше старшего порога — множитель фиксируется', () => {
            expect(resolveFloatPercentMultiplier(linearBorders, 100)).toBe(1.5);
            expect(resolveFloatPercentMultiplier(linearBorders, 150)).toBe(1.5);
        });
    });

    it('порядок порогов во входном массиве не важен — сортируются по fromPlanPercent', () => {
        const shuffled: [PercentBorder, PercentBorder, PercentBorder] = [
            borders[2],
            borders[0],
            borders[1],
        ];
        expect(resolveFloatPercentMultiplier(shuffled, 70)).toBe(1);
    });
});
