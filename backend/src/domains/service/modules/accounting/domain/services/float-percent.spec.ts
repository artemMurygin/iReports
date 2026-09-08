import {
    buildFloatPercentThresholdInfo,
    resolveFloatPercentMultiplier,
    resolveFloatPercentThresholds,
} from './float-percent';
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
        it('ниже первого порога — множитель 0 (правило ещё не действует)', () => {
            expect(resolveFloatPercentMultiplier(linearBorders, 25)).toBe(0);
        });

        it('между порогами — линейная интерполяция от ЭТОГО порога к СЛЕДУЮЩЕМУ', () => {
            // A(50, 0.5) -> B(70, 1): на 60 (середина отрезка) -> 0.75.
            expect(
                resolveFloatPercentMultiplier(linearBorders, 60),
            ).toBeCloseTo(0.75);
            // B(70, 1) -> C(100, 1.5): на 85 (середина отрезка) -> 1.25.
            expect(
                resolveFloatPercentMultiplier(linearBorders, 85),
            ).toBeCloseTo(1.25);
        });

        it('на и выше старшего порога — множитель фиксируется', () => {
            expect(resolveFloatPercentMultiplier(linearBorders, 100)).toBe(1.5);
            expect(resolveFloatPercentMultiplier(linearBorders, 150)).toBe(1.5);
        });
    });

    // Смешанный режим — реальный кейс правила "Начисление онлайн-менеджеру"
    // (0-70% плоско, 70-120% линейно, свыше 120% плоско): mode лежит на
    // пороге, задающем НИЖНЮЮ границу отрезка, и описывает, что происходит
    // ПОСЛЕ него — а не отрезок ДО него.
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
            expect(resolveFloatPercentMultiplier(mixedBorders, 0)).toBe(0.5);
            expect(resolveFloatPercentMultiplier(mixedBorders, 30)).toBe(0.5);
            expect(resolveFloatPercentMultiplier(mixedBorders, 69.9)).toBe(0.5);
        });

        it('70-120% — линейно от 0.7 (на 70%) до 1.2 (на 120%)', () => {
            expect(resolveFloatPercentMultiplier(mixedBorders, 70)).toBe(0.7);
            expect(resolveFloatPercentMultiplier(mixedBorders, 80)).toBeCloseTo(
                0.8,
            );
            expect(resolveFloatPercentMultiplier(mixedBorders, 85)).toBeCloseTo(
                0.85,
            );
            expect(
                resolveFloatPercentMultiplier(mixedBorders, 110),
            ).toBeCloseTo(1.1);
        });

        it('от 120% и выше — плоско на 1.2', () => {
            expect(resolveFloatPercentMultiplier(mixedBorders, 120)).toBe(1.2);
            expect(resolveFloatPercentMultiplier(mixedBorders, 150)).toBe(1.2);
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

// Текущий/следующий порог + разница до него в обороте (Фаза 9, см. PRD
// раздел 6 — "чтобы UI мог показать «до следующего порога осталось N по
// обороту»").
describe('resolveFloatPercentThresholds', () => {
    it('ниже первого порога — currentThreshold отсутствует, nextThreshold — первый', () => {
        const { currentThreshold, nextThreshold } =
            resolveFloatPercentThresholds(borders, 10);
        expect(currentThreshold).toBeNull();
        expect(nextThreshold).toEqual(borders[0]);
    });

    it('между порогами — currentThreshold/nextThreshold соседние', () => {
        const { currentThreshold, nextThreshold } =
            resolveFloatPercentThresholds(borders, 65);
        expect(currentThreshold).toEqual(borders[0]);
        expect(nextThreshold).toEqual(borders[1]);
    });

    it('на пороге — currentThreshold совпадает с ним', () => {
        const { currentThreshold } = resolveFloatPercentThresholds(borders, 70);
        expect(currentThreshold).toEqual(borders[1]);
    });

    it('на и выше старшего порога — nextThreshold отсутствует', () => {
        expect(
            resolveFloatPercentThresholds(borders, 100).nextThreshold,
        ).toBeNull();
        expect(
            resolveFloatPercentThresholds(borders, 200).nextThreshold,
        ).toBeNull();
    });
});

describe('buildFloatPercentThresholdInfo', () => {
    it('считает diffToNext в обороте, а не в процентных пунктах', () => {
        // План 100 000, факт 65% выполнения -> оборот 65 000; следующий
        // порог 70% -> оборот на пороге 70 000; не хватает 5 000.
        const info = buildFloatPercentThresholdInfo(
            borders,
            65,
            100_000,
            65_000,
        );
        expect(info.currentThreshold).toEqual(borders[0]);
        expect(info.nextThreshold).toEqual(borders[1]);
        expect(info.diffToNext).toBe(5_000);
    });

    it('нет следующего порога (выполнение выше старшего) — diffToNext null', () => {
        const info = buildFloatPercentThresholdInfo(
            borders,
            120,
            100_000,
            120_000,
        );
        expect(info.nextThreshold).toBeNull();
        expect(info.diffToNext).toBeNull();
    });
});
