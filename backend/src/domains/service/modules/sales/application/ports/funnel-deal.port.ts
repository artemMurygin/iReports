import { DealListItemEntity } from '../../domain/entities/deal-list-item.entity';
import { DateRange } from '@/shared/domain/date-range.value-object';

// Фильтры отчёта по воронке сервисных сделок (GET /v1/service/sales/funnel-report,
// Фаза 4) — тот же набор, что у легаси getServiceFunnelReportDTO
// (src/TODO/reports/dto/getServiceFunnelReport.dto.ts): диапазон дат
// создания сделки + источники/менеджеры/модели/этапы/группы этапов.
// Пустой массив у любого из id-фильтров means "без фильтра по этому полю"
// (тот же смысл, что и inFilter() в легаси reports.helpers.ts).
export interface ServiceFunnelFilter {
    range: DateRange;
    sourceIds: number[];
    managerIds: number[];
    modelIds: number[];
    stageIds: string[];
    stageGroupIds: string[];
}

// Порт read-side'а воронки — возвращает ту же read-модель, что и список
// сделок (DealListItemEntity), потому что Prisma-запрос идентичен
// (bitrixDeal с include: stage/assignedBy/pointOfContact/leadSource/brand/
// deviceType) — единственное отличие легаси-эндпоинта /reports/service-funnel
// от /deals — набор where-фильтров и фиксированный categoryId (см.
// SERVICE_FUNNEL_CATEGORY_ID). См. также комментарий у DEAL_LIST_REPOSITORY
// про расположение в application/ports/, а не domain/ports/.
export interface FunnelDealRepositoryPort {
    findByFilter(filter: ServiceFunnelFilter): Promise<DealListItemEntity[]>;
}

export const FUNNEL_DEAL_REPOSITORY = Symbol('FUNNEL_DEAL_REPOSITORY');
