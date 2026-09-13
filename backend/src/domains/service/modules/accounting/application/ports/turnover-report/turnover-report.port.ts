import { TurnoverReportSnapshot } from '@/domains/service/modules/accounting/domain/entities/turnover-report/turnover-report-snapshot.entity';

// design.md Decision 6b of add-department-head-salary-rules — persistence-порт над снапшотом
// склада отчёта «Оборачиваемость», собственный для модуля accounting (не переиспользует
// GOODS_TURNOVER_REPORT_LINE_REPOSITORY модуля warehouse — root CLAUDE.md, «Межмодульные
// зависимости внутри backend»).
export interface TurnoverReportRepositoryPort {
    /**
     * Implements FR4 of add-department-head-salary-rules.
     * Восстанавливает снапшот строк отчёта «Оборачиваемость» одного склада за период напрямую из
     * goods_turnover_report_lines через собственный Prisma-делегат модуля accounting — не вызывает
     * ни один сервис/репозиторий модуля warehouse. null — за этот период по этому складу ни одной
     * строки нет (отчёт ещё не пересчитан), не ошибка.
     */
    findByPeriodAndWarehouse(
        period: string,
        warehouseId: number,
    ): Promise<TurnoverReportSnapshot | null>;
}

export const TURNOVER_REPORT_REPOSITORY = Symbol('TURNOVER_REPORT_REPOSITORY');
