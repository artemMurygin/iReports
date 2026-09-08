import type {
    AccrualsSheetEntry,
    CreateServiceInRoappResult,
    CreateServiceRow,
    GasApi,
    ServiceCategory,
    UploadPricesToRoResult,
} from './types'

/** Small artificial network delay so loading states are visible during local development. */
function delay(ms = 150): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Fake data (module-level so it's inspectable/adjustable) ─────────────────

const MOCK_ACCRUALS_ENTRIES: AccrualsSheetEntry[] = [
    { id: '1001', row: 5, value: 1500 },
    { id: '1002', row: 6, value: 2300 },
    { id: '1003', row: 7, value: 0 },
]

// Keys deliberately overlap with MOCK_ACCRUALS_ENTRIES ids so a caller chaining
// getAccrualsSheetEntries() + fetchServiceBonusesMap() sees at least one match,
// and at least one entry whose value differs vs. one that's already up to date.
const MOCK_SERVICE_BONUSES_MAP: Record<string, number> = {
    '1001': 1500, // same as entry value -> not "updated"
    '1002': 2750, // differs from entry value -> "updated"
    '1099': 900, // no matching entry -> ignored
}

const MOCK_CREATE_SERVICE_ROWS: CreateServiceRow[] = [
    {
        row: 12,
        deviceType: 'Смартфон',
        deviceModel: 'iPhone 13',
        partQuality: 'Оригинал',
        name: 'Замена экрана',
        category: 'Смартфоны/iPhone/Замена экрана',
        warranty: 12,
        warrantyPeriod: 'мес.',
        modelNumber: 'A2482',
        engineerBonus: 500,
        price: 8900,
    },
]

const MOCK_SERVICE_CATEGORIES: ServiceCategory[] = [
    { id: 1, name: 'Смартфоны', parentId: null },
    { id: 2, name: 'Ноутбуки', parentId: null },
    { id: 3, name: 'iPhone', parentId: 1 },
    { id: 4, name: 'Android', parentId: 1 },
    { id: 5, name: 'MacBook', parentId: 2 },
    { id: 6, name: 'Замена экрана', parentId: 3 },
    { id: 7, name: 'Замена батареи', parentId: 3 },
    { id: 8, name: 'Замена клавиатуры', parentId: 5 },
]

/** GasApi implementation backed by realistic fake data, for local development outside Apps Script. */
export const mockGasClient: GasApi = {
    async processFile() {
        await delay()
        return crypto.randomUUID()
    },

    async loadPricesFromMS() {
        await delay()
        return 'OK'
    },

    async uploadPricesToMS() {
        await delay()
        return 'OK'
    },

    async uploadSalePricesToMS() {
        await delay()
        return 'OK'
    },

    async uploadPricesToRO(): Promise<UploadPricesToRoResult> {
        await delay()
        return {
            success: true,
            count: { total: 5, valid: 4, create: 2, update: 2, errors: 1 },
        }
    },

    async getAccrualsSheetEntries() {
        await delay()
        return MOCK_ACCRUALS_ENTRIES.map((entry) => ({ ...entry }))
    },

    async fetchServiceBonusesMap() {
        await delay()
        return { ...MOCK_SERVICE_BONUSES_MAP }
    },

    async applyAccrualsUpdates(entries, earningsById) {
        await delay()
        // Mirrors the real .gs comparison logic exactly (see index.gs#applyAccrualsUpdates):
        // only ids present in earningsById AND whose value actually differs get "updated".
        const updatedIds: string[] = []
        for (const entry of entries) {
            if (!(entry.id in earningsById)) continue

            const newValue = earningsById[entry.id]
            if (newValue === entry.value) continue

            updatedIds.push(entry.id)
        }
        return updatedIds
    },

    async getServiceCategories() {
        await delay()
        return MOCK_SERVICE_CATEGORIES.map((category) => ({ ...category }))
    },

    async writeCategoryPathToActiveCell() {
        await delay()
        return 'OK'
    },

    async getCreateServiceRows() {
        await delay()
        return MOCK_CREATE_SERVICE_ROWS.map((row) => ({ ...row }))
    },

    async createServiceInRoapp(): Promise<CreateServiceInRoappResult> {
        await delay()
        return { entityId: Math.floor(Math.random() * 100000) + 1 }
    },

    async writeCreateServiceResult() {
        await delay()
        return 'OK'
    },
}
