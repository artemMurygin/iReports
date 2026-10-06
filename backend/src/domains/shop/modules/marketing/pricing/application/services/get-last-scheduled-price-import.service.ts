import { Inject, Injectable } from '@nestjs/common';
import type { LastScheduledPriceImportResponse } from 'ireports-contracts';
import { LAST_SCHEDULED_IMPORT_STORE } from '../ports/last-scheduled-import-store.port';
import type { LastScheduledImportStore } from '../ports/last-scheduled-import-store.port';

// Итог последней автоматической выгрузки для сайдбара Google Sheets: он хранит «последний запуск» в
// самой таблице и о запусках по крону иначе не узнаёт.
// spec: shop/price-import-schedule#время-последней-автоматической-выгрузки
@Injectable()
export class GetLastScheduledPriceImportService {
    constructor(
        @Inject(LAST_SCHEDULED_IMPORT_STORE)
        private readonly store: LastScheduledImportStore,
    ) {}

    async execute(): Promise<LastScheduledPriceImportResponse> {
        const [run, priceUpdates] = await Promise.all([
            this.store.get(),
            this.store.getPriceUpdates(),
        ]);
        return { run, priceUpdates };
    }
}
