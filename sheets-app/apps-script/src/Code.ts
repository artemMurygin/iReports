/**
 * Menu wiring, the price-file upload entry point, and the МойСклад sync webhook triggers.
 * Ported verbatim from `frontend/GoogleSheetsInterface/index.gs` (lines 1-46) — same function
 * names (so `google.script.run` calls from the sidebar keep working unmodified), same URLs.
 *
 * `getAccrualsSheet_` lives here too (index.gs lines 138-142): it's used by both pricing.ts and
 * categories.ts. Apps Script concatenates every file in the project into one global scope (see
 * ../README.md), so referencing it from another file needs no import — same as the reference.
 */

const BASE_URL = 'https://api.murygin.tech'

function onOpen(): void {
    SpreadsheetApp.getUi().createMenu('Таблица → МС / РЕМ').addItem('Запустить', 'showUploadForm').addToUi()
}

function showUploadForm(): void {
    const html = HtmlService.createHtmlOutputFromFile('upload').setTitle('Интеграции с ERP').setWidth(500)
    SpreadsheetApp.getUi().showSidebar(html)
}

/**
 * Бросает Error с текстом `message` из тела ответа бэкенда, если код ответа >= 400 — `google.script.run`
 * доставит его в `withFailureHandler`, и сайдбар покажет этот текст. Для ошибок валидации к `message`
 * добавляется перечень `errors[].path: message`.
 */
function throwIfHttpError_(response: GoogleAppsScript.URL_Fetch.HTTPResponse, fallback: string): void {
    const code = response.getResponseCode()
    if (code < 400) return

    const text = response.getContentText()
    let message = fallback + ' (HTTP ' + code + ')'
    try {
        const body = JSON.parse(text)
        if (body && body.message) {
            message = String(body.message)
            if (Array.isArray(body.errors) && body.errors.length > 0) {
                const details = body.errors.map(function (e: { path?: unknown[]; message?: string }) {
                    return (e.path ? e.path.join('.') + ': ' : '') + (e.message || '')
                })
                message += ' — ' + details.join('; ')
            }
        }
    } catch (e) {
        message += ': ' + text.slice(0, 200)
    }
    throw new Error(message)
}

/**
 * Calls an n8n webhook with `muteHttpExceptions` and, on a code >= 400, throws an Error whose message is
 * `GAS_HTTP_ERROR:` + JSON `{code, message}` (message = `message` of the JSON body or the raw body start).
 * `google.script.run` only delivers the message text, so the sidebar's gas client decodes this marker back into
 * a structured error (FR12 of sheets-app-redesign). Network failures keep their native text.
 */
function fetchWebhook_(url: string, method: GoogleAppsScript.URL_Fetch.HttpMethod): string {
    const response = UrlFetchApp.fetch(url, {
        method: method,
        contentType: 'application/json',
        muteHttpExceptions: true,
    })
    const code = response.getResponseCode()
    if (code >= 400) {
        const text = response.getContentText()
        let message = text.slice(0, 200)
        try {
            const body = JSON.parse(text)
            if (body && body.message) message = String(body.message).slice(0, 200)
        } catch (e) {
            // not JSON: keep the raw body start
        }
        throw new Error('GAS_HTTP_ERROR:' + JSON.stringify({ code: code, message: message }))
    }
    return 'OK'
}

/** Uploads a base64-encoded price file, returns a job UUID used for a (separate) SSE progress stream. */
function processFile(base64Data: string): string {
    const response = UrlFetchApp.fetch(BASE_URL + '/v1/shop/marketing/pricing/import-costs', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ file: base64Data }),
        muteHttpExceptions: true,
    })

    throwIfHttpError_(response, 'Ошибка загрузки файла')
    const { id } = JSON.parse(response.getContentText())
    return id
}

/**
 * Cancels a running price import on the backend (aborts its LLM requests). Goes through UrlFetchApp rather than a
 * browser fetch, so it does not depend on CORS preflight. Throws on 404/409 (unknown job / already writing).
 */
function cancelImport(uuid: string): string {
    const response = UrlFetchApp.fetch(
        BASE_URL + '/v1/shop/marketing/pricing/import-costs/' + encodeURIComponent(uuid) + '/cancel',
        { method: 'post', muteHttpExceptions: true },
    )
    throwIfHttpError_(response, 'Не удалось отменить импорт')
    return 'OK'
}

/** Triggers a GET webhook that pulls prices from МойСклад. Always resolves to 'OK'. */
function loadPricesFromMS(): string {
    return fetchWebhook_('https://n8n.murygin.tech/webhook/pricesFromMs', 'get')
}

/** Triggers a PATCH webhook that pushes prices to МойСклад. Always resolves to 'OK'. */
function uploadPricesToMS(): string {
    return fetchWebhook_('https://n8n.murygin.tech/webhook/updatePricesInMS', 'patch')
}

/** Triggers a PATCH webhook that pushes sale prices to МойСклад. Always resolves to 'OK'. */
function uploadSalePricesToMS(): string {
    return fetchWebhook_('https://n8n.murygin.tech/webhook/updateSalePricesInMS', 'patch')
}

/** Finds the "accruals" sheet by its stable gid (survives renames/reordering). */
function getAccrualsSheet_(): GoogleAppsScript.Spreadsheet.Sheet | undefined {
    return SpreadsheetApp.getActiveSpreadsheet()
        .getSheets()
        .find((s) => s.getSheetId() === ACCRUALS_SHEET_GID)
}
