import type { PercentBorder } from 'ireports-contracts';
import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { Money } from './money.value-object';

export interface FloatPercentScheduleProps {
    borders: readonly [PercentBorder, PercentBorder, PercentBorder];
}

export interface FloatPercentThresholdInfo {
    currentThreshold: PercentBorder | null;
    nextThreshold: PercentBorder | null;
    diffToNext: number | null;
}

// Зеркало domain/services/float-percent.ts сервиса по алгоритму (issue
// #57 — независимая реализация в домене shop), но здесь — value object, а
// не свободная функция над непроверенным tuple: три порога percentBorders
// — группа полей с реальными инвариантами (см. WHY в create() ниже), а не
// голый примитив, что по backend/CLAUDE.md ("Value Objects") требует VO.
//
// НЕ хранится внутри config сущностей правил (ProductSoldSalaryConfig
// по-прежнему держит сырой percentBorders) —
// salary-rule.schema.ts прямым текстом фиксирует инвариант "конфиг — одни
// и те же данные от HTTP-запроса до jsonb-колонки props, без
// трансформаций", а ShopSalaryRuleMapper generic по всем 4 типам правил,
// без switch по типу. Поэтому FloatPercentSchedule.create(...) вызывается
// на лету в точке использования (calculate() правил, построение отчёта в
// to-salary-report-rules.ts) — так же, как раньше вызывалась свободная
// функция resolveFloatPercentMultiplier.
export class FloatPercentSchedule extends ValueObject<FloatPercentScheduleProps> {
    static create(
        borders: readonly [PercentBorder, PercentBorder, PercentBorder],
    ): FloatPercentSchedule {
        for (const border of borders) {
            if (!border.name.trim()) {
                throw new ArgumentInvalidException(
                    'У порога FloatPercent должно быть непустое название',
                );
            }
            if (border.fromPlanPercent < 0) {
                throw new ArgumentInvalidException(
                    `fromPlanPercent порога FloatPercent не может быть отрицательным: ${border.fromPlanPercent}`,
                );
            }
            if (border.multiplier < 0) {
                throw new ArgumentInvalidException(
                    `multiplier порога FloatPercent не может быть отрицательным: ${border.multiplier}`,
                );
            }
        }

        // Пороги должны "перетекать" один в другой по возрастанию
        // fromPlanPercent, без повторов — не сортируем и не чиним молча:
        // порядок, в котором пороги пришли, обязан быть уже возрастающим,
        // иначе это ошибка конфигурации, а не то, что можно исправить за
        // вызывающего.
        for (let i = 0; i < borders.length - 1; i++) {
            if (borders[i].fromPlanPercent >= borders[i + 1].fromPlanPercent) {
                throw new ArgumentInvalidException(
                    `Пороги FloatPercent должны идти строго по возрастанию fromPlanPercent: ` +
                        `${borders[i].fromPlanPercent} -> ${borders[i + 1].fromPlanPercent}`,
                );
            }
        }

        return new FloatPercentSchedule({ borders });
    }

    getBorders(): readonly [PercentBorder, PercentBorder, PercentBorder] {
        return this.props.borders;
    }

    // mode лежит НА КАЖДОМ пороге и описывает участок ОТ ЭТОГО порога
    // ВПЕРЁД, до следующего порога (или до бесконечности, если порог
    // последний):
    // - FIX    — множитель ступенькой: от fromPlanPercent этого порога и
    //            до следующего действует множитель ЭТОГО порога;
    // - LINEAR — на отрезке [fromPlanPercent этого порога, fromPlanPercent
    //            следующего) множитель линейно интерполируется между
    //            множителем этого порога и множителем следующего.
    // Ниже самого нижнего порога — множитель 0.
    resolveMultiplier(percentCompletion: number): number {
        const borders = this.props.borders;

        let currentIndex = -1;
        for (let i = 0; i < borders.length; i++) {
            if (percentCompletion >= borders[i].fromPlanPercent) {
                currentIndex = i;
            }
        }
        if (currentIndex === -1) {
            return 0;
        }

        const current = borders[currentIndex];
        const next = borders[currentIndex + 1];
        if (current.mode === 'FIX' || !next) {
            return current.multiplier;
        }

        const span = next.fromPlanPercent - current.fromPlanPercent;
        const ratio = (percentCompletion - current.fromPlanPercent) / span;
        return (
            current.multiplier + ratio * (next.multiplier - current.multiplier)
        );
    }

    // Текущий/следующий порог для отчёта (Фаза 13.5) — currentThreshold
    // null, если percentCompletion ниже самого нижнего порога;
    // nextThreshold null, если порогов выше нет.
    resolveThresholds(
        percentCompletion: number,
    ): Pick<FloatPercentThresholdInfo, 'currentThreshold' | 'nextThreshold'> {
        const borders = this.props.borders;

        let current: PercentBorder | null = null;
        let next: PercentBorder | null = null;
        for (const border of borders) {
            if (percentCompletion >= border.fromPlanPercent) {
                current = border;
            } else if (next === null) {
                next = border;
            }
        }
        return { currentThreshold: current, nextThreshold: next };
    }

    // diffToNext — в обороте, не в процентных пунктах, считается от
    // фактического/прогнозного оборота напрямую, а не обратным пересчётом
    // от округлённого percentCompletion.
    buildThresholdInfo(
        percentCompletion: number,
        planTurnover: number,
        actualTurnover: number,
    ): FloatPercentThresholdInfo {
        const { currentThreshold, nextThreshold } =
            this.resolveThresholds(percentCompletion);
        const diffToNext = nextThreshold
            ? Math.max(
                  0,
                  Money.roundRubles(
                      (planTurnover * nextThreshold.fromPlanPercent) / 100 -
                          actualTurnover,
                  ).getValue(),
              )
            : null;
        return { currentThreshold, nextThreshold, diffToNext };
    }
}
