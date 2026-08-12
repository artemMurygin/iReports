import { Inject, Injectable } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { PriceImportJobStatusResponse } from 'ireports-contracts';
import { PRICE_IMPORT_JOB_STORE } from '../ports/price-import-job-store.port';
import type { PriceImportJobStore } from '../ports/price-import-job-store.port';
import { PriceImportJobNotFoundException } from '../../domain/exceptions/price-import-job.exception';
import { toPriceImportJobStatusResponse } from '../mappers/to-price-import-job-status-response.mapper';

// Поток снапшотов джобы поверх PRICE_IMPORT_JOB_STORE.subscribe (Фаза 10) —
// application-обёртка, которую использует SSE-контроллер `GET
// .../import-costs/:id`; heartbeat/`MessageEvent`-обёртка — HTTP-специфичная
// забота самого контроллера (interface-слой), сюда не входит (см.
// комментарий в subscribe-price-import-job-progress.http.controller.ts).
@Injectable()
export class SubscribePriceImportJobProgressService {
    constructor(
        @Inject(PRICE_IMPORT_JOB_STORE)
        private readonly jobStore: PriceImportJobStore,
    ) {}

    execute(id: string): Observable<PriceImportJobStatusResponse> {
        // findById, а не только subscribe(): для несуществующего id обе
        // проверки эквивалентны, но так явно читается намерение — сначала
        // проверяем существование джобы, потом подписываемся.
        if (!this.jobStore.findById(id)) {
            throw new PriceImportJobNotFoundException(id);
        }
        const stream = this.jobStore.subscribe(id);
        if (!stream) {
            throw new PriceImportJobNotFoundException(id);
        }
        return stream.pipe(map((job) => toPriceImportJobStatusResponse(job)));
    }
}
