// design.md Decision 6b of add-department-head-salary-rules — порт «факт. коэффициент
// оборачиваемости по scope (склад, опционально категория)» для зарплатного правила
// DepartmentTurnoverBonus (FR4). Единственная реализация — GetTurnoverPerformanceService,
// восстанавливающая TurnoverReportSnapshot через TURNOVER_REPORT_REPOSITORY.
export interface TurnoverPerformanceReaderPort {
    /**
     * Implements FR4 of add-department-head-salary-rules.
     * Факт. коэффициент оборачиваемости склада `warehouseId` за `period`. `category` — id
     * категории склада (конкретная строка снапшота) или `null` — «весь склад» (агрегат по
     * настоящим корневым категориям, design.md Decision 6b). `null` результат — недостаточно
     * данных: по этому (period, warehouseId) в TurnoverReportSnapshot нет ни одной строки, либо у
     * запрошенной категории/итога коэффициент не рассчитан.
     */
    findForScope(
        period: string,
        warehouseId: number,
        category: number | null,
    ): Promise<number | null>;
}

export const TURNOVER_PERFORMANCE_READER = Symbol(
    'TURNOVER_PERFORMANCE_READER',
);
