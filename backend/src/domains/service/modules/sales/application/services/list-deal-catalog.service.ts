import { Inject, Injectable } from '@nestjs/common';
import type {
    DealListStage as DealListStageResponse,
    DealAssignee as DealAssigneeResponse,
    DealLeadSource as DealLeadSourceResponse,
    DealDeviceType as DealDeviceTypeResponse,
    DealStageGroup as DealStageGroupResponse,
} from 'ireports-contracts';
import { DEAL_CATALOG_READER } from '../ports/deal-catalog.port';
import type { DealCatalogReaderPort } from '../ports/deal-catalog.port';
import {
    toDealListStageResponse,
    toDealAssigneeResponse,
    toDealLeadSourceResponse,
    toDealDeviceTypeResponse,
    toDealStageGroupResponse,
} from '../mappers/to-deal-catalog-response';

// Read-side справочников сделок (см. DEAL_CATALOG_READER) — пять use
// case'ов одного application-сервиса (по образцу ListSalesPlanTemplatesService),
// а не пять отдельных сервисов: каждый метод — тонкая обёртка порт →
// mapper, общей логики между методами нет, дробить дальше незачем. Каждый
// метод обслуживает свой HTTP-контроллер (interface/http-controllers/
// list-deal-*.http.controller.ts) — "один контроллер на use case", как и
// список сделок (ListDealsHttpController).
@Injectable()
export class ListDealCatalogService {
    constructor(
        @Inject(DEAL_CATALOG_READER)
        private readonly dealCatalogReader: DealCatalogReaderPort,
    ) {}

    async listStages(): Promise<DealListStageResponse[]> {
        const stages = await this.dealCatalogReader.findStages();
        return stages.map(toDealListStageResponse);
    }

    async listDeviceTypes(): Promise<DealDeviceTypeResponse[]> {
        const deviceTypes = await this.dealCatalogReader.findDeviceTypes();
        return deviceTypes.map(toDealDeviceTypeResponse);
    }

    async listManagers(): Promise<DealAssigneeResponse[]> {
        const managers = await this.dealCatalogReader.findManagers();
        return managers.map(toDealAssigneeResponse);
    }

    async listSources(): Promise<DealLeadSourceResponse[]> {
        const sources = await this.dealCatalogReader.findSources();
        return sources.map(toDealLeadSourceResponse);
    }

    async listStageGroups(): Promise<DealStageGroupResponse[]> {
        const stageGroups = await this.dealCatalogReader.findStageGroups();
        return stageGroups.map(toDealStageGroupResponse);
    }
}
