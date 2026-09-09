import {
    GoodsTurnoverReportLine as GoodsTurnoverReportLineRecord,
    Prisma,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { GoodsTurnoverReportLine } from '@/domains/service/modules/warehouse/domain/entities/goods-turnover-report/goods-turnover-report-line.entity';
import { GoodsFlowMetric } from '@/domains/service/modules/warehouse/domain/value-objects/goods-flow-metric.value-object';
import { Period } from '@/shared/domain/period.value-object';

export class GoodsTurnoverReportLineMapper
    implements
        Mapper<GoodsTurnoverReportLine, Prisma.GoodsTurnoverReportLineCreateInput>
{
    toDomain(record: GoodsTurnoverReportLineRecord): GoodsTurnoverReportLine {
        return new GoodsTurnoverReportLine({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                period: Period.create(record.period),
                categoryId: record.categoryId,
                warehouseId: record.warehouseId,
                outcome: GoodsFlowMetric.create(
                    record.outcomeQuantity,
                    record.outcomeSum,
                ),
                stock: GoodsFlowMetric.create(
                    record.stockQuantity,
                    record.stockSum,
                ),
                turnoverRatio: record.turnoverRatio,
            },
        });
    }

    toPersistence(
        entity: GoodsTurnoverReportLine,
    ): Prisma.GoodsTurnoverReportLineCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            period: entity.period,
            categoryId: entity.categoryId,
            warehouseId: entity.warehouseId,
            outcomeQuantity: entity.outcome.quantity,
            outcomeSum: entity.outcome.sum,
            stockQuantity: entity.stock.quantity,
            stockSum: entity.stock.sum,
            turnoverRatio: entity.turnoverRatio,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}
