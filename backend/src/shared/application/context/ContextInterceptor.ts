import type { Request } from 'express';
import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { nanoid } from 'nanoid';
import { readRequestId } from '../../logger/request-id';
import { RequestContextService } from './AppRequestContext';

@Injectable()
export class ContextInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<Request>();

        // id генерирует pino-http (genReqId) — единый для HTTP-лога, ответа
        // и контекста; nanoid — лишь фолбэк для запросов без pino-http
        // (например, в тестах). Клиентский body.requestId не используется.
        const requestId = (request && readRequestId(request)) ?? nanoid(6);

        RequestContextService.setRequestId(requestId);

        return next.handle().pipe(
            tap(() => {
                // Perform cleaning if needed
            }),
        );
    }
}
