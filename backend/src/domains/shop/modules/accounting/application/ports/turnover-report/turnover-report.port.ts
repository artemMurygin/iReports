import { TurnoverReportSnapshot } from '@/domains/shop/modules/accounting/domain/entities/turnover-report/turnover-report-snapshot.entity';

// design.md Decision 6b of add-department-head-salary-rules — зеркало
// domains/service/modules/accounting/application/ports/turnover-report/turnover-report.port.ts для
// shop: persistence-порт над снапшотом склада отчёта «Оборачиваемость», собственный для модуля
// accounting/shop (не переиспользует GOODS_TURNOVER_REPORT_REPOSITORY модуля warehouse — root
// CLAUDE.md, «Межмодульные зависимости внутри backend»).
export interface ShopTurnoverReportRepositoryPort {
    /**
     * Implements FR4 of add-department-head-salary-rules.
     * Восстанавливает снапшот строк отчёта «Оборачиваемость» одного склада за период напрямую из
     * moy_sklad_turnover_report_lines через собственный Prisma-делегат модуля accounting/shop — не
     * вызывает ни один сервис/репозиторий модуля warehouse. null — за этот период по этому складу ни
     * одной строки нет (отчёт ещё не пересчитан), не ошибка.
     */
    findByPeriodAndWarehouse(
        period: string,
        warehouseId: string,
    ): Promise<TurnoverReportSnapshot | null>;
}

export const SHOP_TURNOVER_REPORT_REPOSITORY = Symbol(
    'SHOP_TURNOVER_REPORT_REPOSITORY',
);
