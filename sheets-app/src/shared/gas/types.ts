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
}
