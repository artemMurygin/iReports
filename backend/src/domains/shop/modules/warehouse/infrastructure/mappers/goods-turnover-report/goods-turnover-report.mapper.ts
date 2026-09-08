import {
    MoySkladTurnoverReportLine as MoySkladTurnoverReportLineRecord,
    Prisma,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { Period } from '@/shared/domain/period.value-object';
import { GoodsTurnoverReportLine } from '@/domains/shop/modules/warehouse/domain/entities/goods-turnover-report-line/goods-turnover-report-line.entity';
import { Money } from '@/domains/shop/modules/warehouse/domain/value-objects/money.value-object';

// Суммы отчёта хранятся в БД (moy_sklad_turnover_report_lines) в тех же
// копейках, что и Money-VO (см. Money, шапка комментария) — toPersistence/
// toDomain только переключают представление (VO ↔ Int), без пересчёта
// единиц измерения.
export class GoodsTurnoverReportLineMapper implements Mapper<
    GoodsTurnoverReportLine,
    Prisma.MoySkladTurnoverReportLineCreateInput
> {
    toDomain(
        record: MoySkladTurnoverReportLineRecord,
    ): GoodsTurnoverReportLine {
        return new GoodsTurnoverReportLine({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                period: Period.create(record.period),
                categoryId: record.categoryId,
                warehouseId: record.warehouseId,
                turnoverQuantity: record.turnoverQuantity,
                turnoverSum: Money.ofKopecks(record.turnoverSum),
                stockQuantity: record.stockQuantity,
                stockSum: Money.ofKopecks(record.stockSum),
            },
        });
    }

    toPersistence(
        entity: GoodsTurnoverReportLine,
    ): Prisma.MoySkladTurnoverReportLineCreateInput {
        const props = entity.getProps();
        return {
            id: entity.id,
            period: entity.period.getValue(),
            categoryId: entity.categoryId,
            warehouseId: entity.warehouseId,
            turnoverQuantity: entity.turnoverQuantity,
            turnoverSum: entity.turnoverSum.getValue(),
            stockQuantity: entity.stockQuantity,
            stockSum: entity.stockSum.getValue(),
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}
