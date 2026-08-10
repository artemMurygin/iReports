import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface PeriodBounds {
    from: Date;
    to: Date;
}

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
}
