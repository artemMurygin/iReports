import { BadGatewayException, Injectable } from '@nestjs/common';
import { BitrixHttpService } from './bitrix.instance';
import { Filter } from './types';
import { BitrixDealSchema } from './schema';
import { delay } from '../../shared/delay';
import type { AxiosRequestConfig } from 'axios';

@Injectable()
export class BitrixService {
    private DEAL_FIELDS: string[] = [
        'ID',
        'TITLE',
        'STAGE_ID',
        'CATEGORY_ID',
        'CURRENCY_ID',
        'OPPORTUNITY',
        'ASSIGNED_BY_ID',
        'COMPANY_ID',
        'CONTACT_ID',
        'DATE_CREATE',
        'DATE_MODIFY',
        'SOURCE_ID',
        'UF_CRM_1742462651851',
        'UF_CRM_1730472738',
        'UF_CRM_1703248170106',
        'UF_CRM_1703248232698',
        'UF_CRM_1703248682036',
    ];

    constructor(private bitrix: BitrixHttpService) {}

    async *fetchCreatedDeals(fromDate: undefined | Date = undefined) {
        yield* this._fetchDeals(fromDate, 'CREATE');
    }

    async *fetchModifiedDeals(fromDate: undefined | Date = undefined) {
        yield* this._fetchDeals(fromDate, 'MODIFY');
    }

    private async *_fetchDeals(
        fromDate: undefined | Date = undefined,
        fromField: 'MODIFY' | 'CREATE',
    ) {
        const filter: Filter = { CATEGORY_ID: [0, 16, 10, 2] };
        if (fromDate) {
            const moscowDate = new Date(
                fromDate.getTime() + 3 * 60 * 60 * 1000,
            );
            filter[`>=DATE_${fromField}`] = moscowDate
                .toISOString()
                .slice(0, 19);
        }

        let start = 0;

        while (true) {
            const { data } = await this._getWithRetry('/crm.deal.list', {
                params: { select: this.DEAL_FIELDS, filter, start },
            });

            const deals = data.result.map((deal: unknown) =>
                BitrixDealSchema.parse(deal),
            );

            yield deals;

            if (data.next == null) break;

            start = data.next;
            await delay(this.bitrix.BITRIX_DELAY_MS);
        }
    }

    private async _getWithRetry(
        url: string,
        config?: AxiosRequestConfig,
        retries = 4,
    ): Promise<any> {
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                return await this.bitrix.instance.get(url, config);
            } catch (err) {
                if (attempt === retries - 1) {
                    throw new BadGatewayException(
                        `Failed to fetch from Bitrix24: ${err.message}`,
                    );
                }
                await delay(2_000 * (attempt + 1));
            }
        }
    }

    async fetchEmployees() {
        return await this._fetchData('/user.get');
    }

    async fetchEnums() {
        return await this._fetchData('/crm.deal.userfield.list');
    }

    async fetchLeadSources() {
        return await this._fetchData('/crm.deal.userfield.list', {
            params: {
                filter: { FIELD_NAME: 'UF_CRM_1742462651851' },
            },
        });
    }

    async fetchDeviceTypes() {
        return await this._fetchData('/crm.deal.userfield.list', {
            params: {
                filter: { FIELD_NAME: 'UF_CRM_1703248170106' },
            },
        });
    }

    async fetchStages() {
        return await this._fetchData('/crm.status.list', {
            params: {
                filter: {},
            },
        });
    }

    async fetchSources() {
        return await this._fetchData('/crm.status.list', {
            params: {
                filter: { ENTITY_ID: 'SOURCE' },
            },
        });
    }

    private async _fetchData(url: string, params?: AxiosRequestConfig) {
        const { data } = await this._getWithRetry(url, params);
        return data.result;
    }
}
