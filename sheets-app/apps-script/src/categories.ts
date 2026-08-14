/**
 * Service category lookup (for the sidebar's cascading category picker) and bulk "create service
 * in RemOnline" flow. Ported verbatim from `frontend/GoogleSheetsInterface/index.gs` (lines
 * 200-292) — same function names, same URLs, same numeric column/row constants and the
 * `CREATE_SERVICE_MARKER` string (see ../README.md and the task's sanity checklist).
 */

/** A single node of the flat (parentId-linked) service category tree. */
interface ServiceCategory {
    id: number
    name: string
    parentId: number | null
}

/** Fetches the flat service category tree used to power cascading category selects. */
function getServiceCategories(): ServiceCategory[] {
    const response = UrlFetchApp.fetch(BASE_URL + '/roapp/service-categories', {
        method: 'get',
        contentType: 'application/json',
        muteHttpExceptions: true,
    })
    return JSON.parse(response.getContentText())
}

/** Writes `path` into the currently active cell. Always resolves to 'OK'. */
function writeCategoryPathToActiveCell(path: string): string {
    SpreadsheetApp.getActiveSheet().getActiveCell().setValue(path)
    return 'OK'
}

// ── СОЗДАНИЕ УСЛУГ В РЕМОНЛАЙН ─────────────────────────────────

const CREATE_SERVICE_MARKER = 'Создать'
const CREATE_SERVICE_DEVICE_TYPE_COLUMN = 7 // G
const CREATE_SERVICE_DEVICE_MODEL_COLUMN = 8 // H
const CREATE_SERVICE_PART_QUALITY_COLUMN = 9 // I
const CREATE_SERVICE_NAME_COLUMN = 10 // J
const CREATE_SERVICE_CATEGORY_COLUMN = 11 // K
const CREATE_SERVICE_WARRANTY_COLUMN = 12 // L
const CREATE_SERVICE_WARRANTY_PERIOD_COLUMN = 13 // M
const CREATE_SERVICE_MODEL_NUMBER_COLUMN = 14 // N
const CREATE_SERVICE_ENGINEER_BONUS_COLUMN = 73 // BU
const CREATE_SERVICE_PRICE_COLUMN = 51 // AY

/** One row of the accruals sheet marked for service creation, as returned by `getCreateServiceRows`. */
interface CreateServiceRow {
    row: number
    deviceType: unknown
    deviceModel: unknown
    partQuality: unknown
    name: unknown
    category: unknown
    warranty: unknown
    warrantyPeriod: unknown
    modelNumber: unknown
    engineerBonus: unknown
    price: unknown
}

/** Reads the accruals sheet rows marked "Создать" in the id column, for bulk service creation. */
function getCreateServiceRows(): CreateServiceRow[] {
    const sheet = getAccrualsSheet_()!
    const lastRow = sheet.getLastRow()
    if (lastRow < ACCRUALS_FIRST_ROW) return []

    const numRows = lastRow - ACCRUALS_FIRST_ROW + 1
    const readColumn = function (column: number) {
        return sheet.getRange(ACCRUALS_FIRST_ROW, column, numRows, 1).getValues()
    }

    const ids = readColumn(ACCRUALS_ID_COLUMN)
    const deviceTypes = readColumn(CREATE_SERVICE_DEVICE_TYPE_COLUMN)
    const deviceModels = readColumn(CREATE_SERVICE_DEVICE_MODEL_COLUMN)
    const partQualities = readColumn(CREATE_SERVICE_PART_QUALITY_COLUMN)
    const names = readColumn(CREATE_SERVICE_NAME_COLUMN)
    const categories = readColumn(CREATE_SERVICE_CATEGORY_COLUMN)
    const warranties = readColumn(CREATE_SERVICE_WARRANTY_COLUMN)
    const warrantyPeriods = readColumn(CREATE_SERVICE_WARRANTY_PERIOD_COLUMN)
    const modelNumbers = readColumn(CREATE_SERVICE_MODEL_NUMBER_COLUMN)
    const engineerBonuses = readColumn(CREATE_SERVICE_ENGINEER_BONUS_COLUMN)
    const prices = readColumn(CREATE_SERVICE_PRICE_COLUMN)

    const rows: CreateServiceRow[] = []
    for (let i = 0; i < numRows; i++) {
        if (String(ids[i][0]).trim() !== CREATE_SERVICE_MARKER) continue

        rows.push({
            row: ACCRUALS_FIRST_ROW + i,
            deviceType: deviceTypes[i][0],
            deviceModel: deviceModels[i][0],
            partQuality: partQualities[i][0],
            name: names[i][0],
            category: categories[i][0],
            warranty: warranties[i][0],
            warrantyPeriod: warrantyPeriods[i][0],
            modelNumber: modelNumbers[i][0],
            engineerBonus: engineerBonuses[i][0],
            price: prices[i][0],
        })
    }

    return rows
}

/** Result of `createServiceInRoapp` — always has `entityId`, plus whatever else RemOnline returns. */
interface CreateServiceInRoappResult {
    entityId: number
    [key: string]: unknown
}

/** Creates a service in RemOnline from `payload`. */
function createServiceInRoapp(payload: unknown): CreateServiceInRoappResult {
    const response = UrlFetchApp.fetch(BASE_URL + '/custom-api-roapp/create-service', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
    })

    const code = response.getResponseCode()
    const body = JSON.parse(response.getContentText())
    if (code >= 400) {
        throw new Error(body && body.message ? body.message : 'Ошибка создания услуги в Ремонлайн')
    }

    return body
}

/** Writes `value` into the accruals sheet at `row`. Always resolves to 'OK'. */
function writeCreateServiceResult(row: number, value: string | number): string {
    getAccrualsSheet_()!.getRange(row, ACCRUALS_ID_COLUMN).setValue(value)
    return 'OK'
}
