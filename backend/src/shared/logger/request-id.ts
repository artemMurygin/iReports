/**
 * req.id (pino-http) типизирован как string | number | object; наш genReqId
 * всегда отдаёт строку, поэтому объект трактуем как «id нет».
 */
export function readRequestId(req: { id?: unknown }): string | undefined {
    const id = req.id;
    return typeof id === 'string' || typeof id === 'number'
        ? String(id)
        : undefined;
}
