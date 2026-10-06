import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Injectable,
    Optional,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Request, Response } from 'express';
import { Counter } from 'prom-client';
import { ZodValidationException } from 'nestjs-zod';
import { RequestContextService } from '../application/context/AppRequestContext';
import { readRequestId } from '../logger/request-id';
import { routeLabel } from '../logger/http-route';
import { markStackOmitted } from '../logger/omit-stack';
import { toError } from '../logger/to-error';
import { ExceptionBase } from './exception.base';
import { CODE_TO_HTTP_STATUS } from './exception-status.map';
import { ApiErrorResponse } from './exeption.api';

const SERVER_ERROR_STATUS_FROM = 500;

/** UnauthorizedException -> UNAUTHORIZED, BadGatewayException -> BAD_GATEWAY. */
function codeFromClassName(exception: HttpException): string {
    return exception.constructor.name
        .replace(/Exception$/, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toUpperCase();
}

function httpMessage(exception: HttpException): string {
    const body = exception.getResponse();
    if (typeof body === 'string') {
        return body;
    }
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) {
        return message.join('; ');
    }
    return typeof message === 'string' ? message : exception.message;
}

/**
 * Единственный catch-all фильтр: Nest пробует фильтры «последний
 * зарегистрированный — первым», а при наличии @Catch() сам ничего не логирует.
 * Поэтому сюда же отдаём данные для лога (res.err, res.locals.errorCode) —
 * строку лога пишет pino-http на 'finish' — и инкрементируем метрику ошибок.
 */
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
    // @Optional — e2e-тесты контроллеров собирают фильтр через `new`, без метрик.
    constructor(
        @Optional()
        @InjectMetric('http_request_errors_total')
        private readonly errorsCounter?: Counter<string>,
    ) {}

    catch(exception: unknown, host: ArgumentsHost): void {
        const http = host.switchToHttp();
        const req = http.getRequest<Request>();
        const res = http.getResponse<Response>();

        let status: number;
        let code: string;
        let message: string;
        let metadata: unknown;
        let subErrors: ApiErrorResponse['subErrors'];
        let logged: unknown = exception;

        if (exception instanceof ExceptionBase) {
            status =
                CODE_TO_HTTP_STATUS[exception.code] ??
                HttpStatus.INTERNAL_SERVER_ERROR;
            code = exception.code;
            message = exception.message;
            metadata = exception.metadata;
        } else if (exception instanceof ZodValidationException) {
            status = HttpStatus.BAD_REQUEST;
            code = 'VALIDATION_FAILED';
            message = 'Validation failed';
            const zodError = exception.getZodError() as {
                issues: Array<{ path: PropertyKey[]; message: string }>;
            };
            subErrors = zodError.issues.map((i) => ({
                path: i.path.map(String).join('.'),
                message: i.message,
            }));
        } else if (exception instanceof HttpException) {
            status = exception.getStatus();
            code = codeFromClassName(exception);
            message = httpMessage(exception);
        } else {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            code = 'INTERNAL_ERROR';
            // Реальный message не уходит клиенту — он только в логе.
            message = 'Внутренняя ошибка сервера';
            logged = toError(exception);
        }

        // Для 4xx (ошибка клиента) стек в логе не нужен — см. omit-stack.ts.
        if (status < SERVER_ERROR_STATUS_FROM) {
            markStackOmitted(logged);
        }
        res.err = logged as Error;
        res.locals.errorCode = code;
        this.errorsCounter?.inc({
            method: req.method,
            route: routeLabel(req),
            status_code: String(status),
            error_code: code,
        });

        if (res.headersSent) {
            return;
        }

        const correlationId =
            readRequestId(req) ?? RequestContextService.tryGetRequestId() ?? '';

        res.status(status).json(
            new ApiErrorResponse({
                statusCode: status,
                message,
                error: code,
                correlationId,
                metadata,
                subErrors,
            }),
        );
    }
}
