import { isStackOmitted } from './omit-stack';

const RESPONSE_DATA_LIMIT = 1024;

export function truncate(value: string, limit = RESPONSE_DATA_LIMIT): string {
    return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function stringifySafe(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value) ?? '';
    } catch {
        return '[unserializable]';
    }
}

interface AxiosLike {
    config?: { method?: string; url?: string };
    response?: { status?: number; data?: unknown };
}

/**
 * Сериализатор ошибок. pino-http оборачивает сериализаторы (wrapSerializers),
 * поэтому сюда приходит и сырой Error, и уже std-сериализованный объект
 * (с полем .raw) — stdSerializers.err повторно не вызываем, берём поля вручную.
 * Для AxiosError — строгий whitelist: заголовки конфига/запроса содержат токены
 * и никогда не должны попасть в лог.
 */
export function errSerializer(input: unknown): unknown {
    if (input === null || typeof input !== 'object') {
        return input;
    }
    const err = input as Record<string, unknown> & AxiosLike;
    const raw = (err.raw ?? err) as Record<string, unknown> & AxiosLike;

    const out: Record<string, unknown> = {
        type:
            err.type ??
            (raw as { constructor?: { name?: string } }).constructor?.name ??
            'Error',
        message: err.message ?? raw.message,
    };
    const stack = (err.stack ?? raw.stack) as string | undefined;
    if (stack && !isStackOmitted(raw)) {
        out.stack = stack;
    }
    const code = err.code ?? raw.code;
    if (code !== undefined) {
        out.code = code;
    }
    const status = err.status ?? raw.status;
    if (status !== undefined) {
        out.status = status;
    }

    const config = err.config ?? raw.config;
    if (config && (config.method !== undefined || config.url !== undefined)) {
        out.config = { method: config.method, url: config.url };
    }
    // Только HTTP-ответ внешнего API (AxiosError: есть status). У Nest
    // HttpException поле response — это тело нашего же ответа, оно уже в msg.
    const response = err.response ?? raw.response;
    if (
        response &&
        typeof response === 'object' &&
        typeof response.status === 'number'
    ) {
        out.response = {
            status: response.status,
            ...(response.data === undefined
                ? {}
                : { data: truncate(stringifySafe(response.data)) }),
        };
    }
    return out;
}
