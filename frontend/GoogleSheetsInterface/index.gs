const BASE_URL = 'https://api.murygin.tech'

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('Таблица → МС / РЕМ')
        .addItem('Запустить', 'showUploadForm')
        .addToUi()
}

function showUploadForm() {
    const html = HtmlService.createHtmlOutputFromFile('upload')
        .setTitle('Интеграции с ERP')
        .setWidth(500)
    SpreadsheetApp.getUi().showSidebar(html)
}

function processFile(base64Data) {
    const response = UrlFetchApp.fetch(BASE_URL + '/price-monitoring/update-shop-products-costs', {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({ file: base64Data }),
        muteHttpExceptions: true,
    })

    const { id } = JSON.parse(response.getContentText())
    return id
}

function loadPricesFromMS() {
    UrlFetchApp.fetch('https://n8n.murygin.tech/webhook/pricesFromMs', {
        method: 'GET',
        contentType: 'application/json',
    })
    return 'OK'
}

function uploadPricesToMS() {
    UrlFetchApp.fetch('https://n8n.murygin.tech/webhook/updatePricesInMS', {
        method: 'PATCH',
        contentType: 'application/json',
    })
    return 'OK'
}

function uploadSalePricesToMS() {
    UrlFetchApp.fetch('https://n8n.murygin.tech/webhook/updateSalePricesInMS', {
        method: 'PATCH',
        contentType: 'application/json',
    })
    return 'OK'
}

const ACCRUALS_SHEET_GID = 1714253184
const ACCRUALS_ID_COLUMN = 5 // E
const ACCRUALS_SUM_COLUMN = 72 // BS
const ACCRUALS_FIRST_ROW = 5
const RO_NEW_PRICE_COLUMN = 61 // BH
const RO_OLD_PRICE_COLUMN = 50 // AW

function uploadPricesToRO() {
    const sheet = getAccrualsSheet_()
    console.log('uploadPricesToRO: sheet=%s', sheet ? sheet.getName() : null)

    const lastRow = sheet.getLastRow()
    console.log('uploadPricesToRO: lastRow=%s', lastRow)
    const emptyResult = {
        success: true,
        count: { total: 0, valid: 0, create: 0, update: 0, errors: 0 },
    }
    if (lastRow < ACCRUALS_FIRST_ROW) {
        console.log('uploadPricesToRO: lastRow < ACCRUALS_FIRST_ROW, exiting early')
        return emptyResult
    }

    const numRows = lastRow - ACCRUALS_FIRST_ROW + 1
    const ids = sheet.getRange(ACCRUALS_FIRST_ROW, ACCRUALS_ID_COLUMN, numRows, 1).getValues()
    const newPrices = sheet
        .getRange(ACCRUALS_FIRST_ROW, RO_NEW_PRICE_COLUMN, numRows, 1)
        .getValues()
    const accruals = sheet.getRange(ACCRUALS_FIRST_ROW, ACCRUALS_SUM_COLUMN, numRows, 1).getValues()
    console.log('uploadPricesToRO: numRows=%s', numRows)

    const items = []
    const sentRows = []
    for (let i = 0; i < numRows; i++) {
        const row = ACCRUALS_FIRST_ROW + i
        const rawId = ids[i][0]
        const rawPrice = newPrices[i][0]
        if (rawId === '' || rawId === null || rawPrice === '' || rawPrice === null) continue

        const id = toNumber_(rawId)
        const price = toNumber_(rawPrice)
        if (id === null || price === null) {
            console.log(
                'uploadPricesToRO: skipping row %s, non-numeric id=%s price=%s',
                row,
                JSON.stringify(rawId),
                JSON.stringify(rawPrice),
            )
            continue
        }

        items.push({ id: id, price: price, serviceCost: accruals[i][0] })
        sentRows.push({ row: row, price: price })
    }
    console.log('uploadPricesToRO: items.length=%s, items=%s', items.length, JSON.stringify(items))

    if (items.length === 0) {
        console.log('uploadPricesToRO: no items to send, exiting')
        return emptyResult
    }

    const response = UrlFetchApp.fetch(BASE_URL + '/price-monitoring/update-service-price', {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(items),
        muteHttpExceptions: true,
    })
    console.log(
        'uploadPricesToRO: response code=%s, body=%s',
        response.getResponseCode(),
        response.getContentText(),
    )

    const result = JSON.parse(response.getContentText())

    if (result.success) {
        console.log('uploadPricesToRO: writing back %s rows', sentRows.length)
        sentRows.forEach(function (entry) {
            sheet.getRange(entry.row, RO_OLD_PRICE_COLUMN).setValue(entry.price)
            sheet.getRange(entry.row, RO_NEW_PRICE_COLUMN).setValue('')
        })
    } else {
        console.log('uploadPricesToRO: result.success is falsy, skipping write-back')
    }

    return result
}

function toNumber_(value) {
    if (typeof value === 'number') return isFinite(value) ? value : null
    if (typeof value !== 'string') return null
    const normalized = value.replace(/[\s ]+/g, '').replace(',', '.')
    if (normalized === '') return null
    const num = Number(normalized)
    return isFinite(num) ? num : null
}

function getAccrualsSheet_() {
    return SpreadsheetApp.getActiveSpreadsheet()
        .getSheets()
        .find((s) => s.getSheetId() === ACCRUALS_SHEET_GID)
}

function getAccrualsSheetEntries() {
    const sheet = getAccrualsSheet_()
    const lastRow = sheet.getLastRow()
    if (lastRow < ACCRUALS_FIRST_ROW) return []

    const numRows = lastRow - ACCRUALS_FIRST_ROW + 1
    const ids = sheet.getRange(ACCRUALS_FIRST_ROW, ACCRUALS_ID_COLUMN, numRows, 1).getValues()
    const oldSums = sheet.getRange(ACCRUALS_FIRST_ROW, ACCRUALS_SUM_COLUMN, numRows, 1).getValues()

    const entries = []
    ids.forEach(function (row, i) {
        const id = row[0]
        if (id === '' || id === null) return
        entries.push({ id: String(id), row: ACCRUALS_FIRST_ROW + i, value: oldSums[i][0] })
    })

    return entries
}

function fetchServiceBonusesMap() {
    const response = UrlFetchApp.fetch('http://rm.murygin.tech/getServicesBonuses', {
        method: 'GET',
        contentType: 'application/json',
        muteHttpExceptions: true,
    })
    const bonuses = JSON.parse(response.getContentText())

    const earningsById = {}
    bonuses.forEach(function (bonus) {
        earningsById[String(bonus.objectId)] = bonus.earningsSum
    })

    return earningsById
}

function applyAccrualsUpdates(entries, earningsById) {
    const sheet = getAccrualsSheet_()

    const updatedIds = []
    entries.forEach(function (entry) {
        if (!(entry.id in earningsById)) return

        const newValue = earningsById[entry.id]
        if (newValue === entry.value) return

        sheet.getRange(entry.row, ACCRUALS_SUM_COLUMN).setValue(newValue)
        updatedIds.push(entry.id)
    })

    return updatedIds
}

function getServiceCategories() {
    const response = UrlFetchApp.fetch(BASE_URL + '/roapp/service-categories', {
        method: 'GET',
        contentType: 'application/json',
        muteHttpExceptions: true,
    })
    return JSON.parse(response.getContentText())
}

function writeCategoryPathToActiveCell(path) {
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

function getCreateServiceRows() {
    const sheet = getAccrualsSheet_()
    const lastRow = sheet.getLastRow()
    if (lastRow < ACCRUALS_FIRST_ROW) return []

    const numRows = lastRow - ACCRUALS_FIRST_ROW + 1
    const readColumn = function (column) {
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

    const rows = []
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

function createServiceInRoapp(payload) {
    const response = UrlFetchApp.fetch(BASE_URL + '/custom-api-roapp/create-service', {
        method: 'POST',
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

function writeCreateServiceResult(row, value) {
    getAccrualsSheet_().getRange(row, ACCRUALS_ID_COLUMN).setValue(value)
    return 'OK'
}
