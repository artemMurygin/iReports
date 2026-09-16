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
    INVALID_TASK_LINK_URL,
    INVALID_TASK_TRANSITION,
    NOT_FOUND,
    SALARY_RULE_NOT_FOUND,
    TASK_ALREADY_CLOSED,
    TASK_COMMENT_BODY_EMPTY,
} from './exception.codes';

const CODE_TO_HTTP_STATUS: Record<string, HttpStatus> = {
    [ARGUMENT_INVALID]: HttpStatus.BAD_REQUEST,
    [ARGUMENT_NOT_PROVIDED]: HttpStatus.BAD_REQUEST,
    [ARGUMENT_OUT_OF_RANGE]: HttpStatus.BAD_REQUEST,
    [CONFLICT]: HttpStatus.CONFLICT,
    [NOT_FOUND]: HttpStatus.NOT_FOUND,
    // src/modules/tasks — недопустимый переход статуса задачи (граф
    // TaskStatus.canTransitionTo) — конфликт с текущим состоянием задачи,
    // тот же HTTP-статус, что и CONFLICT.
    [INVALID_TASK_TRANSITION]: HttpStatus.CONFLICT,
    // src/modules/tasks (add-task-salary-rule-links-comments) — пустой/
    // пробельный текст комментария и синтаксически невалидный URL ссылки
    // отклоняются до сохранения (tasks.md, группы 13-14) — те же 4xx, что и
    // ARGUMENT_INVALID.
    [TASK_COMMENT_BODY_EMPTY]: HttpStatus.BAD_REQUEST,
    [INVALID_TASK_LINK_URL]: HttpStatus.BAD_REQUEST,
    // src/modules/tasks (edit-task) — попытка отредактировать поля задачи,
    // уже находящейся в терминальном статусе — конфликт с текущим
    // состоянием задачи, тот же HTTP-статус, что и INVALID_TASK_TRANSITION
    // (не невалидный ввод, а недопустимая операция над текущим состоянием).
    [TASK_ALREADY_CLOSED]: HttpStatus.CONFLICT,
    // domains/{service,shop}/modules/accounting (add-task-salary-rule-links-comments,
    // раздел 19 tasks.md) — GetSalaryRuleService/GetShopSalaryRuleService не
    // нашли правило по id (SalaryRuleNotFoundException/
    // ShopSalaryRuleNotFoundException, оба используют этот общий код, см. WHY
    // над SALARY_RULE_NOT_FOUND в exception.codes.ts). Раньше не было в этой
    // карте (эти exception-классы, в отличие от остальных Not Found в
    // проекте, не наследуют общий NotFoundException, а объявляют
    // специфичный код напрямую) — без записи здесь падало в 500 вместо 404.
    [SALARY_RULE_NOT_FOUND]: HttpStatus.NOT_FOUND,
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
