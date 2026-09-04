import { ConflictException } from '@/shared/exceptions';

// FloatPercent (OrderPayed) не может посчитать множитель без
// SalesPerformance подразделения сотрудника за период (Фаза 8, задача плана
// "отсутствие плана на период даёт внятную доменную ошибку"). Возникает,
// когда для CalculationContext.salesPerformance не нашлось строки плана —
// либо у сотрудника нет отдела, либо для (direction, period, department)
// ещё не создан ни план, ни факт/прогноз (см. BuildServiceCalculationContextService).
export class SalesPerformanceRequiredException extends ConflictException {
    constructor(period: string) {
        super(
            `Для расчёта правила с плавающим процентом (FloatPercent) за период ${period} ` +
                'отсутствует план продаж подразделения сотрудника — расчёт невозможен',
        );
    }
}
