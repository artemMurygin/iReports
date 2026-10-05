import { GasHttpError } from '@/shared/gas/types'
import type { OperationError } from '@/features/operations/operationContext'

const KNOWN_DETAIL: Record<number, string> = {
    400: 'Некорректный запрос · проверьте данные в листе',
    401: 'Нет доступа · проверьте токен интеграции',
    403: 'Недостаточно прав для этой операции',
    429: 'Слишком много запросов · повторите через минуту',
    504: 'Сервер не успел ответить · операция могла выполниться, проверьте результат в МойСклад',
}

const NETWORK_RE = /failed to fetch|network|timed? ?out|dns|address unavailable|нет связи|сет[ьи]/i

/** `UrlFetchApp` throws «Request failed for ... returned code 429. Truncated server response: ...». */
function extractHttpCode(message: string): number | null {
    const m = /returned code (\d{3})/i.exec(message) ?? /\b(?:HTTP|status|код)\D{0,3}([45]\d{2})\b/i.exec(message)
    return m ? Number(m[1]) : null
}

function extractBody(message: string): string | null {
    const m = /Truncated server response:\s*([\s\S]+?)(?:\s*\(use muteHttpExceptions[^)]*\))?$/i.exec(message)
    const body = m?.[1]?.trim()
    return body ? body : null
}

/**
 * Implements FR6, FR12 of sheets-app-redesign: maps an МойСклад webhook failure to the banner texts. The HTTP code
 * comes structurally from `GasHttpError` (Phase 7), falling back to the exception text.
 */
export function parseMoySkladError(err: unknown): OperationError {
    const message = err instanceof Error ? err.message : String(err)
    // Phase 7: webhooks deliver the code structurally (`GasHttpError`); the text regexp stays for other failures.
    const code = err instanceof GasHttpError ? err.code : extractHttpCode(message)

    if (code !== null) {
        const detail =
            KNOWN_DETAIL[code] ??
            (code >= 500 && code <= 599
                ? 'Сервис МойСклад временно недоступен · повторите позже'
                : (err instanceof GasHttpError ? err.message : extractBody(message)) || 'Неожиданный ответ сервиса')
        return { code: String(code), title: `МойСклад ответил ${code}`, detail }
    }
    if (NETWORK_RE.test(message)) {
        return { code: 'сети', title: 'Нет связи с МойСклад', detail: 'Проверьте подключение и повторите' }
    }
    return { title: 'Не удалось выполнить операцию', detail: message || 'Неожиданный ответ сервиса' }
}
