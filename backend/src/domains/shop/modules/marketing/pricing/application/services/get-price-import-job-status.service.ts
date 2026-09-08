import { Inject, Injectable } from '@nestjs/common';
import type { PriceImportJobStatusResponse } from 'ireports-contracts';
import { PRICE_IMPORT_JOB_STORE } from '../ports/price-import-job-store.port';
import type { PriceImportJobStore } from '../ports/price-import-job-store.port';
import { PriceImportJobNotFoundException } from '../../domain/exceptions/price-import-job.exception';
import { toPriceImportJobStatusResponse } from '../mappers/to-price-import-job-status-response.mapper';

// Query-сервис поверх PRICE_IMPORT_JOB_STORE (Фаза 10, по образцу
// ListDealsService/ListSalesPlansService — без QueryBus) — единственная точка
// доступа контроллера `GET .../import-costs/:id/status` к состоянию джобы;
// сам контроллер порт не инжектит напрямую (см. domains/service/CLAUDE.md,
// правило "controller -> application service", а не "controller -> port").
@Injectable()
export class GetPriceImportJobStatusService {
    constructor(
        @Inject(PRICE_IMPORT_JOB_STORE)
        private readonly jobStore: PriceImportJobStore,
    ) {}

    execute(id: string): PriceImportJobStatusResponse {
        const job = this.jobStore.findById(id);
        if (!job) {
            throw new PriceImportJobNotFoundException(id);
        }
        return toPriceImportJobStatusResponse(job);
    }
}
