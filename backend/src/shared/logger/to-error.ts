/**
 * Приводит произвольное значение из `catch (e)` к Error, чтобы логгер получал
 * объект, который pino умеет сериализовать (type/message/stack), а не строку
 * или произвольный объект. Исходное значение сохраняется в `cause`.
 */
export function toError(value: unknown): Error {
    if (value instanceof Error) {
        return value;
    }
    const error = new Error(String(value));
    (error as Error & { cause?: unknown }).cause = value;
    return error;
}
