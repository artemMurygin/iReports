import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface PeriodBounds {
    from: Date;
    to: Date;
}

// Период расчёта зарплаты в формате 'YYYY-MM'. Инкапсулирует формат
// (используется как /accounting/salary_report/employee/:id/:period, так и
// CalculationContext.period) и вычисление границ месяца — раньше обе вещи
// были раскиданы по GetEmployeeSalaryReportService (regexp + отдельная
// buildMonthBounds).
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
}
