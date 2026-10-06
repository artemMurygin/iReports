export interface LoggerPort {
    log(message: string, ...meta: unknown[]): void;
    error(message: string, trace?: unknown, ...meta: unknown[]): void;
    warn(message: string, ...meta: unknown[]): void;
    // Объектная форма — структурные поля для pino (requestId приходит из mixin).
    debug(message: string | object, ...meta: unknown[]): void;
}
