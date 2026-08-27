import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface PeriodBounds {
    from: Date;
    to: Date;
}

// Те же названия месяцев (именительный падеж), что и
// frontend/src/shared/lib/format.ts::formatPeriodLabel — держим текст
// в комментариях движений ленты баланса (toRuLabel) идентичным тому, что
// фронтенд рисует сам для периода документа.
const MONTHS_NOMINATIVE = [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь',
];

// Период в формате 'YYYY-MM' — общий для accounting (расчёт зарплаты,
// CalculationContext.period) и sales (SalesPlan.period, Фаза 3):
// инкапсулирует формат и вычисление границ месяца, чтобы regexp и разбор
// строки не расходились по модулям. Изначально жил только в accounting
// (см. историю get-employee-salary-report.service.ts), переехал сюда, как
// только период понадобился второму модулю.
export class Period extends ValueObject<string> {
    static create(value: string): Period {
        if (!PERIOD_PATTERN.test(value)) {
            throw new ArgumentInvalidException(
                `Период должен быть в формате YYYY-MM, получено: "${value}"`,
            );
        }
        return new Period({ value });
    }

    getValue(): string {
        return this.props.value;
    }

    // 'июль 2026' — человекочитаемая подпись для автогенерируемых текстов
    // (см. BalanceTransaction.forAccruedLine: комментарий движения
    // «<правило> · <toRuLabel()>», чтобы сотрудник видел месяц начисления
    // прямо в ленте баланса, не открывая документ).
    toRuLabel(): string {
        const [year, month] = this.props.value.split('-');
        return `${MONTHS_NOMINATIVE[Number(month) - 1]} ${year}`;
    }

    // Границы месяца в UTC: 00:00:00.000 первого дня — 23:59:59.999
    // последнего (день 0 следующего месяца — стандартный трюк Date для
    // "последний день текущего месяца").
    getBounds(): PeriodBounds {
        const [year, month] = this.props.value.split('-').map(Number);
        return {
            from: new Date(Date.UTC(year, month - 1, 1)),
            to: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
        };
    }

    // Предыдущий месяц — источник значений для автосоздания плана (Фаза 4,
    // см. EnsureSalesPlansForPeriodService: "план предыдущего месяца +
    // growthPercent"). Тот же UTC-трюк с "нулевым" месяцем, что и в
    // getBounds() — Date сам переносит январь в декабрь предыдущего года.
    previous(): Period {
        const [year, month] = this.props.value.split('-').map(Number);
        const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
        return Period.fromDate(prevMonthDate);
    }

    // Текущий период "сейчас" в UTC — общая точка отсчёта для крона
    // (SalesPlanAutoCreationCron) и ленивого достраивания, чтобы границы
    // месяца в кроне и в самом Period не расходились по временной зоне (см.
    // docs/prd-payroll-calculation.md: "иначе план и факт разъедутся на
    // сутки").
    static current(): Period {
        return Period.fromDate(new Date());
    }

    private static fromDate(date: Date): Period {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        return Period.create(`${year}-${month}`);
    }

    // Месяц целиком истёк к моменту `now` — "первое число следующего месяца
    // и позже" (PRD 1 docs/payroll-closing-and-accrual: закрыть можно только
    // истёкший календарный месяц). Граница — в UTC, как и getBounds(): иначе
    // "истёкший месяц" закрытия и границы факта расчёта разъехались бы по
    // временной зоне.
    isExpired(now: Date = new Date()): boolean {
        return now.getTime() > this.getBounds().to.getTime();
    }

    // Сколько дней в месяце периода целиком — последнее число месяца
    // равно длине месяца (см. трюк "день 0 следующего месяца" в
    // getBounds()).
    getTotalCalendarDays(): number {
        return this.getBounds().to.getUTCDate();
    }

    // Сколько календарных дней месяца уже полностью прошло к моменту `now`
    // — вход формулы линейной экстраполяции SalesPrognose (Фаза 5, см.
    // docs/payroll/plan-payroll-calculation.md). Решение, что считать
    // "прошедшим днём", зафиксировано и должно оставаться единым везде,
    // где используется этот метод: день засчитывается прошедшим, только
    // когда он уже целиком закончился — текущие, ещё не завершившиеся
    // сутки в счёт не идут (00:00 первого числа → 0 прошедших дней, 00:00
    // второго числа → 1 прошедший день, и так далее). Результат зажат в
    // границах [0, общее число дней месяца]: `now` раньше начала периода
    // даёт 0, `now` на или после конца периода (закрытый месяц или период
    // целиком в прошлом) даёт полное число дней месяца — экстраполировать
    // в этом случае уже нечего.
    getElapsedCalendarDays(now: Date = new Date()): number {
        const { from } = this.getBounds();
        const totalDays = this.getTotalCalendarDays();
        const elapsedMs = now.getTime() - from.getTime();
        const elapsedDays = Math.floor(elapsedMs / MS_PER_DAY);
        return Math.min(Math.max(elapsedDays, 0), totalDays);
    }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
