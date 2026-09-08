export class ApiErrorResponse {
    readonly statusCode: number;
    readonly message: string;
    readonly error: string;
    readonly correlationId: string;
    readonly subErrors?: string[];
    // Структурированные данные ошибки (ExceptionBase.metadata) — например,
    // перечень неутверждённых строк плана (metadata.rows) или документов
    // начисления не в DRAFT (metadata.accruals), которые фронтенд показывает
    // без дополнительного запроса. Отсутствует, если исключение его не несёт.
    readonly metadata?: unknown;

    constructor(body: ApiErrorResponse) {
        this.statusCode = body.statusCode;
        this.message = body.message;
        this.error = body.error;
        this.correlationId = body.correlationId;
        this.subErrors = body.subErrors;
        this.metadata = body.metadata;
    }
}
