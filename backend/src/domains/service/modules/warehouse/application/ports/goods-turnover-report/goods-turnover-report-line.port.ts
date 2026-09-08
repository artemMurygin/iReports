import { GoodsTurnoverReportLine } from '@/domains/service/modules/warehouse/domain/entities/goods-turnover-report/goods-turnover-report-line.entity';

// Persistence-порт над строками отчёта по оборачиваемости (design.md D4:
// строки периода полностью перезаписываются при каждом пересчёте, отдельной
// истории версий нет — предыдущий пересчёт того же периода теряется).
export interface GoodsTurnoverReportLineRepositoryPort {
    // Сохранённые строки периода — используется и для отдачи отчёта
    // (GetGoodsTurnoverReportService, задача 10), и для чтения остатка
    // ПРЕДЫДУЩЕГО периода в BuildGoodsTurnoverReportService (задача 9,
    // GoodsTurnoverReportLine.calcRatio). Пустой список — валидный результат
    // (период ещё ни разу не пересчитан), не ошибка.
    findByPeriod(period: string): Promise<GoodsTurnoverReportLine[]>;

    // Полная замена набора строк периода: сначала удаляет все существующие
    // строки этого периода, затем вставляет переданные — атомарно, в одной
    // транзакции (см. AccountingPeriodSnapshotRepository.saveAll как
    // референс того же приёма). Пустой lines — валидный вызов (отчёт без
    // единой пары категория-склад с движением, теоретически), очищает
    // период до пустого набора строк.
    replaceAll(
        period: string,
        lines: GoodsTurnoverReportLine[],
    ): Promise<void>;
}

export const GOODS_TURNOVER_REPORT_LINE_REPOSITORY = Symbol(
    'GOODS_TURNOVER_REPORT_LINE_REPOSITORY',
);
