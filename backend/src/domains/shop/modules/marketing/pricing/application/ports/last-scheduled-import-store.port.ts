export interface LastScheduledImportRun {
    status: 'success' | 'error';
    /** Epoch ms завершения запуска. */
    finishedAt: number;
}

/**
 * Итог последней автоматической выгрузки прайса — для сайдбара Google Sheets, который иначе не
 * знает о запусках по крону. spec: shop/price-import-schedule#время-последней-автоматической-выгрузки
 */
export interface LastScheduledImportStore {
    save(run: LastScheduledImportRun): Promise<void>;

    /** `null`, если автоматических выгрузок ещё не было. */
    get(): Promise<LastScheduledImportRun | null>;
}

export const LAST_SCHEDULED_IMPORT_STORE = Symbol(
    'LAST_SCHEDULED_IMPORT_STORE',
);
