import { DealListItemEntity } from '../../domain/entities/deal-list-item.entity';
import { DateRange } from '@/shared/domain/date-range.value-object';

// Порт read-side'а списка сделок (GET /v1/service/sales/deals, см.
// src/domains/service/CLAUDE.md, "modules/sales — Сделки/лиды"). Живёт в
// application/ports/, а не в domain/ports/ (там сейчас LeadRepositoryPort/
// DealRepositoryPort из sales.repositories.port.ts) — по прецеденту
// SalesPerformanceReaderPort (application/ports/sales-performance.port.ts):
// это тоже чистый read/query-порт, обслуживающий один application-сервис
// (ListDealsService), а не часть доменной модели агрегата.
//
// Единственный метод — то, что реально вызывается ListDealsService, см.
// YAGNI-комментарий в
// accounting/application/ports/motivation-schema/motivation-schema.port.ts.
export interface DealListRepositoryPort {
    findByDateRange(range: DateRange): Promise<DealListItemEntity[]>;
}

export const DEAL_LIST_REPOSITORY = Symbol('DEAL_LIST_REPOSITORY');
