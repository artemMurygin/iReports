import { DealListStage } from '../../domain/value-objects/deal-list-stage.value-object';
import { DealAssignee } from '../../domain/value-objects/deal-assignee.value-object';
import { DealLeadSource } from '../../domain/value-objects/deal-lead-source.value-object';
import { DealDeviceType } from '../../domain/value-objects/deal-device-type.value-object';
import { DealStageGroup } from '../../domain/value-objects/deal-stage-group.value-object';

// Порт read-side'а справочников сделок (Фаза 2,
// docs/todo-modules-ddd-refactoring) — пять GET-эндпоинтов, которые сейчас
// обслуживает TODO/deals/deals.service.ts (getStages/getDeviceTypes/
// getDealsManagers/getDealsSources/getStageGroups). Один порт, а не пять
// (по одному на метод) — все пять читают разные Prisma-модели ради одного
// логического "справочника сделок", используемого одним application-
// сервисом (ListDealCatalogService), как и было у легаси DealsService.
// Реализация — DealCatalogRepository (infrastructure/repositories);
// возвращаемые VO переиспользуют те же классы, что и read-модель списка
// сделок (deal-list.port.ts), потому что формы совпадают byte-в-byte
// (см. contracts/commands/deal.ts).
export interface DealCatalogReaderPort {
    findStages(): Promise<DealListStage[]>;
    findDeviceTypes(): Promise<DealDeviceType[]>;
    // Батч-выборка менеджеров: легаси-версия (getDealsManagers) делает один
    // bitrixEmployee.findFirst на каждый distinct assignedById (N+1) — эта
    // реализация обязана быть одним запросом (bitrixEmployee.findMany с
    // where.id.in), см. комментарий в DealCatalogRepository.
    findManagers(): Promise<DealAssignee[]>;
    findSources(): Promise<DealLeadSource[]>;
    findStageGroups(): Promise<DealStageGroup[]>;
}

export const DEAL_CATALOG_READER = Symbol('DEAL_CATALOG_READER');
