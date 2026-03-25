import axios from 'axios'
import { bitrix } from '../shared/axios.instance'
import { Filter } from '../types/bitrix.types';


class BitrixService {
    private static DEAL_FIELDS: string[] = [
        'ID', 'TITLE', 'STAGE_ID', 'CURRENCY_ID', 'OPPORTUNITY',
        'ASSIGNED_BY_ID', 'COMPANY_ID', 'CONTACT_ID', 'DATE_CREATE',
        'DATE_MODIFY', 'SOURCE_ID', 'UF_CRM_1742462651851', 'UF_CRM_1730472738',
        'UF_CRM_1703248170106', 'UF_CRM_1703248232698', 'UF_CRM_1703248682036',
    ];
    private static BITRIX_DELAY_MS = 500;
    private static sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    async* fetchCreatedDeals(fromDate: undefined | Date = undefined) {
        yield* this._fetchDeals(fromDate, 'CREATE');
    }

    async* fetchModifiedDeals(fromDate: undefined | Date = undefined) {
        yield* this._fetchDeals(fromDate, 'MODIFY');
    }
    private async* _fetchDeals(fromDate: undefined | Date = undefined, fromField: 'MODIFY' | 'CREATE')  {
        const filter: Filter = { CATEGORY_ID: 0 };

        if (fromDate) filter[`>=DATE_${fromField}`] = fromDate.toISOString().slice(0, 19)

        let start = 0;

        while (true) {
            try {
                const { data } = await bitrix.get('/crm.deal.list', {
                    params: { select: BitrixService.DEAL_FIELDS, filter, start },
                });

                yield data.result;

                if (data.next == null) break;

                start = data.next;
                await BitrixService.sleep(BitrixService.BITRIX_DELAY_MS);

            } catch (err) {
                if (!axios.isAxiosError(err)) throw err;
                const status = err.response?.status;
                const detail = err.response?.data?.error_description || err.message;
                throw new Error(`Bitrix24 network error (HTTP ${status ?? 'N/A'}): ${detail}`);
            }
        }
    }

    async fetchEmployees() {
        try {
            const { data } = await bitrix.get('/user.get')
            return data.result
        } catch (err) {
            console.log('[BitrixService] Failed to fetch employees:', err instanceof Error ? err.message : err);
        }
    }

    async fetchEnums() {
        try {
            const { data } = await bitrix.get('/crm.deal.userfield.list')
            return data.result
        } catch (err) {
            console.log('[BitrixService] Failed to fetch enums:', err instanceof Error ? err.message : err);
        }
    }

    async fetchStages() {
        try {
            const { data } = await bitrix.get('/crm.status.list', {
                params: {
                    filter: { ENTITY_ID: "DEAL_STAGE" }
                }
            })
            return data.result
        } catch (err) {
            console.log('[BitrixService] Failed to fetch DEAL_STAGE:', err instanceof Error ? err.message : err);
        }
    }

    async fetchSources() {
        try {
            const { data } = await bitrix.get('/crm.status.list', {
                params: {
                    filter: { ENTITY_ID: "SOURCE" }
                }
            })
            return data.result
        } catch (err) {
            console.log('[BitrixService] Failed to fetch SOURCE:', err instanceof Error ? err.message : err);
        }
    }
}

const Bitrix = new BitrixService()
export { Bitrix }
