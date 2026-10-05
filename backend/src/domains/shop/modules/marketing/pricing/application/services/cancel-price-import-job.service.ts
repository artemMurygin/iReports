import { Inject, Injectable } from '@nestjs/common';
import type { CancelPriceImportResponse } from 'ireports-contracts';
import { PRICE_IMPORT_ABORT_REGISTRY } from '../ports/price-import-abort-registry.port';
import type { PriceImportAbortRegistry } from '../ports/price-import-abort-registry.port';
import { PRICE_IMPORT_JOB_STORE } from '../ports/price-import-job-store.port';
import type { PriceImportJobStore } from '../ports/price-import-job-store.port';
import { PriceImportJobNotFoundException } from '../../domain/exceptions/price-import-job.exception';

// Отмена джобы импорта: переводит агрегат в CANCELLED (бросает 409, если джоба завершена или уже
// пишет в МойСклад/Sheets), публикует статус подписчикам SSE и абортит все её запросы к LLM.
@Injectable()
export class CancelPriceImportJobService {
    constructor(
        @Inject(PRICE_IMPORT_JOB_STORE)
        private readonly jobStore: PriceImportJobStore,
        @Inject(PRICE_IMPORT_ABORT_REGISTRY)
        private readonly abortRegistry: PriceImportAbortRegistry,
    ) {}

    execute(id: string): CancelPriceImportResponse {
        const job = this.jobStore.findById(id);
        if (!job) {
            throw new PriceImportJobNotFoundException(id);
        }
        job.cancel();
        this.jobStore.save(job);
        this.abortRegistry.abort(id);
        return { id, status: 'CANCELLED' };
    }
}
