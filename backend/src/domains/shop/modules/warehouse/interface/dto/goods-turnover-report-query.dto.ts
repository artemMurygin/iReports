import { createZodDto } from 'nestjs-zod';
import { goodsTurnoverReportQuerySchema } from 'ireports-contracts';

// Опциональный фильтр по складу — GET .../goods-turnover-report/:period?
// warehouseId=... (см. GetGoodsTurnoverReportHttpController), по образцу
// ShopSalesPlanListQueryDto (modules/sales/interface/dto).
export class GoodsTurnoverReportQueryDto extends createZodDto(
    goodsTurnoverReportQuerySchema,
) {}
