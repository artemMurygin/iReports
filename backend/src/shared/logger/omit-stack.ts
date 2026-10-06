// Для 4xx стек — шум (ошибка клиента, не баг сервера). Решение «стек не нужен»
// принимает AllExceptionsFilter (он знает HTTP-статус), а убирает стек
// errSerializer. Флаг — неперечислимое свойство на самом объекте ошибки,
// чтобы не сериализовать ошибку дважды (повторный проход std-сериализатора
// pino превращал бы type в 'Object').
const OMIT_STACK = Symbol.for('ireports.logger.omitStack');

export function markStackOmitted(error: unknown): void {
    if (error !== null && typeof error === 'object') {
        Object.defineProperty(error, OMIT_STACK, {
            value: true,
            enumerable: false,
            configurable: true,
        });
    }
}

export function isStackOmitted(error: unknown): boolean {
    return (
        error !== null &&
        typeof error === 'object' &&
        (error as Record<symbol, unknown>)[OMIT_STACK] === true
    );
}
