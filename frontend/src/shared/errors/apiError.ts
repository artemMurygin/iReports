import { isAxiosError } from 'axios'

export class ApiError extends Error {
    constructor(errorString: string) {
        super(errorString)
    }
}

/**
 * Достаёт человекочитаемое `message` из тела ответа бэкенда, если оно есть, вместо генерик-текста.
 * Backend-исключения (`ExceptionBase`/`DomainExceptionFilter`, `shared/exceptions`) всегда отдают
 * `{ statusCode, message: string, error, correlationId, metadata }` — тот же формат, что уже читают
 * несколько мест фичи `EmployeeBalance`/`SalaryAccruals` (см. `payoutHelpers.ts`'s
 * `readPayoutErrorMessage`), вынесенный сюда как общая инфраструктура (`shared/`, без бизнес-логики),
 * а не переизобретённый в каждом новом `api.ts`. Нужен в первую очередь мутациям сохранения
 * зарплатной схемы (change salary-rule-bitrix-task, "Ошибка Bitrix24 при сохранении откатывает
 * схему" — руководитель должен увидеть причину с бэкенда, например `TaskRuleBitrixDeletionFailedException`'s
 * текст, а не общее "Не удалось сохранить схему"), но не завязан на них специально.
 *
 * Раньше `.catch()`-блоки конкатенировали `String(error)` прямо в текст `ApiError`
 * (`'Не удалось сохранить схему ' + error`) — для axios-ошибки это даёт нечитаемое "Error: Request
 * failed with status code 400" вместо причины на бэкенде; эта функция возвращает `fallback` в том
 * же случае (тело не парсится/это не axios-ошибка/`message` не строка), сохраняя прежнее поведение
 * как безопасный дефолт.
 */
export function extractApiErrorMessage(error: unknown, fallback: string): string {
    if (isAxiosError(error)) {
        const body = error.response?.data as { message?: unknown } | undefined
        if (typeof body?.message === 'string' && body.message.trim() !== '') return body.message
    }
    return fallback
}
