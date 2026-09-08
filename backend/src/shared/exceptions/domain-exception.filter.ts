import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ExceptionBase } from './exception.base';
import { ApiErrorResponse } from './exeption.api';
import {
    ARGUMENT_INVALID,
    ARGUMENT_NOT_PROVIDED,
    ARGUMENT_OUT_OF_RANGE,
    CONFLICT,
    NOT_FOUND,
} from './exception.codes';

const CODE_TO_HTTP_STATUS: Record<string, HttpStatus> = {
    [ARGUMENT_INVALID]: HttpStatus.BAD_REQUEST,
    [ARGUMENT_NOT_PROVIDED]: HttpStatus.BAD_REQUEST,
    [ARGUMENT_OUT_OF_RANGE]: HttpStatus.BAD_REQUEST,
    [CONFLICT]: HttpStatus.CONFLICT,
    [NOT_FOUND]: HttpStatus.NOT_FOUND,
};

/**
 * Переводит доменные/прикладные ошибки (ExceptionBase и наследники)
 * в HTTP-ответ с корректным статусом. Это единственное место, где
 * доменный `code` знает про HTTP — сами domain/application слои
 * про HttpException ничего не знают и знать не должны.
 */
@Catch(ExceptionBase)
export class DomainExceptionFilter implements ExceptionFilter {
    catch(exception: ExceptionBase, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>();
        const status =
            CODE_TO_HTTP_STATUS[exception.code] ??
            HttpStatus.INTERNAL_SERVER_ERROR;

        response.status(status).json(
            new ApiErrorResponse({
                statusCode: status,
                message: exception.message,
                error: exception.code,
                correlationId: exception.correlationId,
                metadata: exception.metadata,
            }),
        );
    }
}
