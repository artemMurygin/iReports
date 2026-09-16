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

        it('между порогами — множитель пропорционален проценту выполнения плана, а не интерполируется к следующему порогу', () => {
            // A(50, 0.5): на 60 -> 0.5 * 60/100 = 0.3 (multiplier следующего
            // порога B (1) не участвует).
            expect(
                resolveFloatPercentMultiplier(linearBorders, 60),
            ).toBeCloseTo(0.3);
            // B(70, 1): на 85 -> 1 * 85/100 = 0.85 (multiplier следующего
            // порога C (1.5) не участвует).
            expect(
                resolveFloatPercentMultiplier(linearBorders, 85),
            ).toBeCloseTo(0.85);
        });

        it('на границе сегмента (percentCompletion === current.fromPlanPercent) — множитель не обязан равняться multiplier этого порога', () => {
            // B(70, 1) становится current ровно на 70% -> 1 * 70/100 = 0.7,
            // а не 1 (это не FIX-ступенька).
            expect(
                resolveFloatPercentMultiplier(linearBorders, 70),
            ).toBeCloseTo(0.7);
        });

        it('чуть ниже следующего порога — множитель всё ещё считается от текущего порога, не от следующего', () => {
            // B(70, 1) остаётся current до 100 (не включая) -> на 99.9
            // -> 1 * 99.9/100 = 0.999, а не близко к multiplier следующего
            // порога C (1.5).
            expect(
                resolveFloatPercentMultiplier(linearBorders, 99.9),
            ).toBeCloseTo(0.999);
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

        it('70-120% — множитель нижнего порога (0.7), умноженный на процент выполнения плана', () => {
            expect(resolveFloatPercentMultiplier(mixedBorders, 70)).toBeCloseTo(
                0.49,
            ); // 0.7 * 70/100
            expect(resolveFloatPercentMultiplier(mixedBorders, 80)).toBeCloseTo(
                0.56,
            ); // 0.7 * 80/100
            expect(resolveFloatPercentMultiplier(mixedBorders, 85)).toBeCloseTo(
                0.595,
            ); // 0.7 * 85/100
            expect(
                resolveFloatPercentMultiplier(mixedBorders, 110),
            ).toBeCloseTo(0.77); // 0.7 * 110/100
        });

        // Точный кейс из бага: план выполнен на 95.59% (меньше 100%), но
        // старая формула (интерполяция к multiplier следующего порога 1.2)
        // давала множитель 1.10236 — больше 1 при невыполненном плане.
        it('регрессия: план не выполнен (95.59%) — множитель меньше 1, а не больше', () => {
            const multiplier = resolveFloatPercentMultiplier(
                mixedBorders,
                95.59,
            );
            expect(multiplier).toBeCloseTo(0.7 * (95.59 / 100));
            expect(multiplier).toBeLessThan(1);
        });

        it('от 120% и выше — плоско на 1.2 (FIX не затронут изменением формулы LINEAR)', () => {
            expect(resolveFloatPercentMultiplier(mixedBorders, 120)).toBe(1.2);
            expect(resolveFloatPercentMultiplier(mixedBorders, 150)).toBe(1.2);
        });
    });

    // Точные пороги из бага (значения multiplier как в реальном зарплатном
    // правиле "Сервис"): при выполнении плана на 95.59% старая формула
    // (интерполяция к multiplier следующего порога) давала множитель
    // 1.10236 (appliedPercent 5.5118% при базовых 5%) — выше базового
    // процента при НЕвыполненном плане.
    it('регрессия из бага: fromPlanPercent 70/multiplier 1 -> 120/multiplier 1.2, 95.59% -> ~0.9559, а не 1.10236', () => {
        const realBorders: [PercentBorder, PercentBorder, PercentBorder] = [
            {
                name: 'Ниже плана',
                fromPlanPercent: 0,
                multiplier: 0,
                mode: 'FIX',
            },
            {
                name: 'Выполнение плана',
                fromPlanPercent: 70,
                multiplier: 1,
                mode: 'LINEAR',
            },
            {
                name: 'Перевыполнение',
                fromPlanPercent: 120,
                multiplier: 1.2,
                mode: 'FIX',
            },
        ];
        expect(resolveFloatPercentMultiplier(realBorders, 95.59)).toBeCloseTo(
            0.9559,
        );
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
