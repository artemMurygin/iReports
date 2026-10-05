/**
 * Typed surface of the Apps Script server-side API (see
 * `frontend/GoogleSheetsInterface/index.gs` for the reference implementation
 * this interface mirrors). Implemented by both `realGasClient` (delegates to
 * `google.script.run` inside a real Sheets sidebar) and `mockGasClient` (for
 * local development outside Apps Script).
 */

/** One row of the "accruals" sheet range, as returned by `getAccrualsSheetEntries`. */
export interface AccrualsSheetEntry {
    id: string
    row: number
    value: unknown
}

/** Aggregate counters returned by `uploadPricesToRO`. */
export interface UploadPricesToRoCount {
    total: number
    valid: number
    create: number
    update: number
    errors: number
}

export interface UploadPricesToRoResult {
    success: boolean
    count: UploadPricesToRoCount
}

/** A single node of the flat (parentId-linked) service category tree. */
export interface ServiceCategory {
    id: number
    name: string
    parentId: number | null
}

/** Result of `createServiceInRoapp` — always has `entityId`, plus whatever else RemOnline returns. */
export interface CreateServiceInRoappResult {
    entityId: number
    [key: string]: unknown
}

/** One row of the "accruals" sheet marked for service creation, as returned by `getCreateServiceRows`. */
export interface CreateServiceRow {
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

/**
 * Implements FR11, FR12 of sheets-app-redesign: compact record of the last run of one sidebar function, stored in
 * `PropertiesService.getDocumentProperties()` (9 KB per value, so only counters, a clamped message and a few row
 * errors are kept, not the full report).
 */
export interface OperationReport {
    /** Operation id, e.g. `ms.load`, `ro.uploadPrices` (letters, digits, `_.-`, up to 40 chars). */
    operation: string
    status: 'success' | 'error'
    /** Epoch ms. */
    finishedAt: number
    counters?: Record<string, number>
    /** Error banner title (error only). */
    title?: string
    /** Error detail (error only). */
    message?: string
    /** HTTP code or `'сети'` (error only). */
    errorCode?: string
    /** Up to 5 per-row error texts. */
    errors?: string[]
}

/** Structured failure of a server call: the HTTP code and message of the upstream response (FR12). */
export class GasHttpError extends Error {
    code: number
    constructor(code: number, message: string) {
        super(message)
        this.name = 'GasHttpError'
        this.code = code
    }
}

/** Prefix the Apps Script webhooks put before the JSON `{code, message}` of a failed response. */
export const GAS_HTTP_ERROR_MARKER = 'GAS_HTTP_ERROR:'

export interface GasApi {
    /** Uploads a base64-encoded price file, returns a job UUID used for a (separate) SSE progress stream. */
    processFile(base64Data: string): Promise<string>

    /** Triggers a GET webhook that pulls prices from МойСклад. Always resolves to 'OK'. */
    loadPricesFromMS(): Promise<string>

    /** Triggers a PATCH webhook that pushes prices to МойСклад. Always resolves to 'OK'. */
    uploadPricesToMS(): Promise<string>

    /** Triggers a PATCH webhook that pushes sale prices to МойСклад. Always resolves to 'OK'. */
    uploadSalePricesToMS(): Promise<string>

    /** Reads sheet rows, posts prices to RemOnline via backend, writes old prices back to the sheet. */
    uploadPricesToRO(): Promise<UploadPricesToRoResult>

    /** Reads the accruals sheet range and returns its entries. */
    getAccrualsSheetEntries(): Promise<AccrualsSheetEntry[]>

    /** Fetches a map of objectId -> earningsSum from the external service bonuses endpoint. */
    fetchServiceBonusesMap(): Promise<Record<string, number>>

    /**
     * Compares `entries` against `earningsById` and writes any differing sums back to the sheet.
     * Returns the ids that were actually updated (present in `earningsById` AND value differs).
     */
    applyAccrualsUpdates(entries: AccrualsSheetEntry[], earningsById: Record<string, number>): Promise<string[]>

    /** Fetches the flat service category tree used to power cascading category selects. */
    getServiceCategories(): Promise<ServiceCategory[]>

    /** Writes `path` into the currently active cell. Always resolves to 'OK'. */
    writeCategoryPathToActiveCell(path: string): Promise<string>

    /** Reads the accruals sheet rows marked "Создать" in the id column, for bulk service creation. */
    getCreateServiceRows(): Promise<CreateServiceRow[]>

    /** Creates a service in RemOnline from `payload`. */
    createServiceInRoapp(payload: unknown): Promise<CreateServiceInRoappResult>

    /** Writes `value` into the accruals sheet at `row`. Always resolves to 'OK'. */
    writeCreateServiceResult(row: number, value: string | number): Promise<string>

    /** Reads the stored report of `operation`, or `null` when it never ran. */
    getLastRun(operation: string): Promise<OperationReport | null>

    /** Stores the report of a finished run (overwrites the previous one of the same operation). */
    saveLastRun(report: OperationReport): Promise<string>

    /** Reads every stored report keyed by operation id; one call on sidebar open. */
    getAllLastRuns(): Promise<Record<string, OperationReport>>
}
