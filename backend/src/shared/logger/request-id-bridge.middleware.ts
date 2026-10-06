import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { readRequestId } from './request-id';
import { RequestContextService } from '../application/context/AppRequestContext';

/**
 * pino-http выполняется раньше RequestContextMiddleware (LoggerModule
 * глобальный), поэтому req.id уже сгенерирован, а AsyncLocalStorage-контекста
 * ещё нет. Мост переносит id в контекст, чтобы mixin логгера и ExceptionBase
 * видели тот же requestId, что и строка HTTP-лога.
 */
@Injectable()
export class RequestIdBridgeMiddleware implements NestMiddleware {
    use(req: Request, _res: Response, next: NextFunction): void {
        const id = readRequestId(req);
        if (id !== undefined) {
            RequestContextService.setRequestId(id);
        }
        next();
    }
}
