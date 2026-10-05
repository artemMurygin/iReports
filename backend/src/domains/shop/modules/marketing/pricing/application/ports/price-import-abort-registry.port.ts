// Реестр AbortController'ов выполняющихся джоб импорта цен: StartPriceImportHandler регистрирует
// сигнал на старте пайплайна, сервис отмены вызывает abort(id) — так обрываются все запросы к LLM
// и МойСклад, привязанные к сигналу этой джобы.
export interface PriceImportAbortRegistry {
    register(id: string): AbortSignal;

    /** Абортит сигнал джобы; no-op, если джоба не зарегистрирована. */
    abort(id: string): void;

    release(id: string): void;
}

export const PRICE_IMPORT_ABORT_REGISTRY = Symbol(
    'PRICE_IMPORT_ABORT_REGISTRY',
);
