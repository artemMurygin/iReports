import { Inject, Injectable } from '@nestjs/common';
import type { ActivePriceImportJobResponse } from 'ireports-contracts';
import { PRICE_IMPORT_JOB_STORE } from '../ports/price-import-job-store.port';
import type { PriceImportJobStore } from '../ports/price-import-job-store.port';

// Отдаёт id выполняющейся джобы импорта: сайдбар Google Sheets после повторного открытия окна
// по нему возвращается к прогрессу (подключается к SSE/поллингу того же id).
@Injectable()
export class GetActivePriceImportJobService {
    constructor(
        @Inject(PRICE_IMPORT_JOB_STORE)
        private readonly jobStore: PriceImportJobStore,
    ) {}

    execute(): ActivePriceImportJobResponse {
        return { id: this.jobStore.findActive()?.id ?? null };
    }
}
