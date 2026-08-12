import { Inject, Injectable } from '@nestjs/common';
import type { ListDealsResponse } from 'ireports-contracts';
import { DEAL_LIST_REPOSITORY } from '../ports/deal-list.port';
import type { DealListRepositoryPort } from '../ports/deal-list.port';
import { DateRange } from '@/shared/domain/date-range.value-object';
import { toDealListItemResponse } from '../mappers/to-deal-list-item-response';

// Read-side списка сделок (GET /v1/service/sales/deals) — DateRange уже
// провалидирован контроллером (парсинг from/to — забота HTTP-слоя, Фаза 3
// этой миграции, не этого сервиса, см. задание Фазы 2). `total` считается
// здесь, а не в контроллере: это вычисляемое значение (`deals.length`), а в
// целевой слоистости сборка формы ответа use case'а — дело application-
// слоя, а не HTTP-слоя (в отличие от легаси
// src/TODO/deals/deals.controller.ts, где `{ total: deals.length, deals }`
// собирался прямо в контроллере).
@Injectable()
export class ListDealsService {
    constructor(
        @Inject(DEAL_LIST_REPOSITORY)
        private readonly dealListRepository: DealListRepositoryPort,
    ) {}

    async execute(range: DateRange): Promise<ListDealsResponse> {
        const deals = await this.dealListRepository.findByDateRange(range);
        return {
            total: deals.length,
            deals: deals.map(toDealListItemResponse),
        };
    }
}
