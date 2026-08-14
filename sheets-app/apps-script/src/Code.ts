/**
 * Menu wiring, the price-file upload entry point, and the МойСклад sync webhook triggers.
 * Ported verbatim from `frontend/GoogleSheetsInterface/index.gs` (lines 1-46) — same function
 * names (so `google.script.run` calls from the sidebar keep working unmodified), same URLs.
 *
 * `getAccrualsSheet_` lives here too (index.gs lines 138-142): it's used by both pricing.ts and
 * categories.ts. Apps Script concatenates every file in the project into one global scope (see
 * ../README.md), so referencing it from another file needs no import — same as the reference.
 */

// const BASE_URL = 'https://api.murygin.tech'
const BASE_URL = 'https://36cd-45-145-40-211.ngrok-free.app'

function onOpen(): void {
    SpreadsheetApp.getUi().createMenu('Таблица → МС / РЕМ').addItem('Запустить', 'showUploadForm').addToUi()
}

function showUploadForm(): void {
    const html = HtmlService.createHtmlOutputFromFile('upload').setTitle('Интеграции с ERP').setWidth(500)
    SpreadsheetApp.getUi().showSidebar(html)
}

/** Uploads a base64-encoded price file, returns a job UUID used for a (separate) SSE progress stream. */
function processFile(base64Data: string): string {
    const response = UrlFetchApp.fetch(BASE_URL + '/v1/shop/marketing/pricing/import-costs', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ file: base64Data }),
        muteHttpExceptions: true,
    })

    const { id } = JSON.parse(response.getContentText())
    return id
}

/** Triggers a GET webhook that pulls prices from МойСклад. Always resolves to 'OK'. */
function loadPricesFromMS(): string {
    UrlFetchApp.fetch('https://n8n.murygin.tech/webhook/pricesFromMs', {
        method: 'get',
        contentType: 'application/json',
    })
    return 'OK'
}

/** Triggers a PATCH webhook that pushes prices to МойСклад. Always resolves to 'OK'. */
function uploadPricesToMS(): string {
    UrlFetchApp.fetch('https://n8n.murygin.tech/webhook/updatePricesInMS', {
        method: 'patch',
        contentType: 'application/json',
    })
    return 'OK'
}

/** Triggers a PATCH webhook that pushes sale prices to МойСклад. Always resolves to 'OK'. */
function uploadSalePricesToMS(): string {
    UrlFetchApp.fetch('https://n8n.murygin.tech/webhook/updateSalePricesInMS', {
        method: 'patch',
        contentType: 'application/json',
    })
    return 'OK'
}

/** Finds the "accruals" sheet by its stable gid (survives renames/reordering). */
function getAccrualsSheet_(): GoogleAppsScript.Spreadsheet.Sheet | undefined {
    return SpreadsheetApp.getActiveSpreadsheet()
        .getSheets()
        .find((s) => s.getSheetId() === ACCRUALS_SHEET_GID)
}
