/**
 * The accruals sheet's shared column/row layout, the RemOnline price upload flow, and the
 * accruals-vs-RemOnline-bonuses sync flow. Ported verbatim from
 * `frontend/GoogleSheetsInterface/index.gs` (lines 48-198) — same function names, same URLs, same
 * numeric column/row constants (see ../README.md and the task's sanity checklist).
 *
 * `toNumber_` (used by `uploadPricesToRO`) lives in ./toNumber_.ts; `getAccrualsSheet_` (used
 * throughout this file and by categories.ts) lives in ./Code.ts. Both are visible here with no
 * import, same as they'll be once Apps Script concatenates every src file into one global scope.
 */

const ACCRUALS_SHEET_GID = 1714253184
const ACCRUALS_ID_COLUMN = 5 // E
const ACCRUALS_SUM_COLUMN = 72 // BS
const ACCRUALS_FIRST_ROW = 5
const RO_NEW_PRICE_COLUMN = 61 // BH
const RO_OLD_PRICE_COLUMN = 50 // AW

interface UploadPricesToRoCount {
    total: number
    valid: number
    create: number
    update: number
    errors: number
}

interface UploadPricesToRoResult {
    success: boolean
    count: UploadPricesToRoCount
}

/** Reads sheet rows, posts prices to RemOnline via backend, writes old prices back to the sheet. */
function uploadPricesToRO(): UploadPricesToRoResult {
    // Non-null assertion: matches the reference's untyped assumption that the accruals sheet
    // always exists — if it doesn't, both this and the reference throw a TypeError right below.
    const sheet = getAccrualsSheet_()!
    console.log('uploadPricesToRO: sheet=%s', sheet ? sheet.getName() : null)

    const lastRow = sheet.getLastRow()
    console.log('uploadPricesToRO: lastRow=%s', lastRow)
    const emptyResult: UploadPricesToRoResult = {
        success: true,
        count: { total: 0, valid: 0, create: 0, update: 0, errors: 0 },
    }
    if (lastRow < ACCRUALS_FIRST_ROW) {
        console.log('uploadPricesToRO: lastRow < ACCRUALS_FIRST_ROW, exiting early')
        return emptyResult
    }

    const numRows = lastRow - ACCRUALS_FIRST_ROW + 1
    const ids = sheet.getRange(ACCRUALS_FIRST_ROW, ACCRUALS_ID_COLUMN, numRows, 1).getValues()
    const newPrices = sheet.getRange(ACCRUALS_FIRST_ROW, RO_NEW_PRICE_COLUMN, numRows, 1).getValues()
    const accruals = sheet.getRange(ACCRUALS_FIRST_ROW, ACCRUALS_SUM_COLUMN, numRows, 1).getValues()
    console.log('uploadPricesToRO: numRows=%s', numRows)

    const items: { id: number; price: number; serviceCost: unknown }[] = []
    const sentRows: { row: number; price: number }[] = []
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

    const response = UrlFetchApp.fetch(BASE_URL + '/v1/service/marketing/pricing/update-service-prices', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(items),
        muteHttpExceptions: true,
    })
    console.log('uploadPricesToRO: response code=%s, body=%s', response.getResponseCode(), response.getContentText())

    const result: UploadPricesToRoResult = JSON.parse(response.getContentText())

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

/** One row of the accruals sheet range, as returned by `getAccrualsSheetEntries`. */
interface AccrualsSheetEntry {
    id: string
    row: number
    value: unknown
}

/** Reads the accruals sheet range and returns its entries. */
function getAccrualsSheetEntries(): AccrualsSheetEntry[] {
    const sheet = getAccrualsSheet_()!
    const lastRow = sheet.getLastRow()
    if (lastRow < ACCRUALS_FIRST_ROW) return []

    const numRows = lastRow - ACCRUALS_FIRST_ROW + 1
    const ids = sheet.getRange(ACCRUALS_FIRST_ROW, ACCRUALS_ID_COLUMN, numRows, 1).getValues()
    const oldSums = sheet.getRange(ACCRUALS_FIRST_ROW, ACCRUALS_SUM_COLUMN, numRows, 1).getValues()

    const entries: AccrualsSheetEntry[] = []
    ids.forEach(function (row, i) {
        const id = row[0]
        if (id === '' || id === null) return
        entries.push({
            id: String(id),
            row: ACCRUALS_FIRST_ROW + i,
            value: oldSums[i][0],
        })
    })

    return entries
}

/** Fetches a map of objectId -> earningsSum from the external service bonuses endpoint. */
function fetchServiceBonusesMap(): Record<string, number> {
    const response = UrlFetchApp.fetch('http://rm.murygin.tech/getServicesBonuses', {
        method: 'get',
        contentType: 'application/json',
        muteHttpExceptions: true,
    })
    const bonuses: { objectId: unknown; earningsSum: number }[] = JSON.parse(response.getContentText())

    const earningsById: Record<string, number> = {}
    bonuses.forEach(function (bonus) {
        earningsById[String(bonus.objectId)] = bonus.earningsSum
    })

    return earningsById
}

/**
 * Compares `entries` against `earningsById` and writes any differing sums back to the sheet.
 * Returns the ids that were actually updated (present in `earningsById` AND value differs).
 */
function applyAccrualsUpdates(entries: AccrualsSheetEntry[], earningsById: Record<string, number>): string[] {
    const sheet = getAccrualsSheet_()!

    const updatedIds: string[] = []
    entries.forEach(function (entry) {
        if (!(entry.id in earningsById)) return

        const newValue = earningsById[entry.id]
        if (newValue === entry.value) return

        sheet.getRange(entry.row, ACCRUALS_SUM_COLUMN).setValue(newValue)
        updatedIds.push(entry.id)
    })

    return updatedIds
}
