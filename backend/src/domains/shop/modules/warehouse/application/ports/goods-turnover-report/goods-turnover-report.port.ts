import { Period } from '@/shared/domain/period.value-object';
import { GoodsTurnoverReportLine } from '@/domains/shop/modules/warehouse/domain/entities/goods-turnover-report-line/goods-turnover-report-line.entity';

// Единственная точка записи/чтения строк отчёта по оборачиваемости
// (см. architecture.md, таблица Services). Отчёт не моделируется как один
// агрегат "на весь период" — каждая строка (категория × склад) независима,
// поэтому пересчёт периода выражается как массовая операция репозитория
// (replaceForPeriod), а не save() одной огромной сущности.
export interface GoodsTurnoverReportRepositoryPort {
    findByPeriod(period: Period): Promise<GoodsTurnoverReportLine[]>;

    // Полная замена строк периода одной транзакцией: старые строки этого
    // периода удаляются, новые записываются; строки других периодов не
    // затрагиваются. implements design.md D7.2/architecture.md of
    // shop-turnover-report.
    replaceForPeriod(
        period: Period,
        lines: GoodsTurnoverReportLine[],
    ): Promise<void>;
}

export const GOODS_TURNOVER_REPORT_REPOSITORY = Symbol(
    'GOODS_TURNOVER_REPORT_REPOSITORY',
);
