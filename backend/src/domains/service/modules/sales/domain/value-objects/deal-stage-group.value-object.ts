import { ValueObject } from '@/shared/domain/value-object.base';

// Группа этапов сделки (Bitrix "категория этапов") для справочника сделок
// (GET /v1/service/sales/deals/stage-groups) — производный список,
// вычисляемый из distinct (stageGroupId, stageGroupName) по BitrixStage
// (entityId: 'DEAL_STAGE'), а не отдельная Prisma-модель: у BitrixStage нет
// собственной таблицы групп, только два денормализованных столбца (см.
// TODO/deals/deals.service.ts, getStageGroups()). Отдельный VO, а не
// переиспользование id/name из DealListStage — те два поля здесь не часть
// стадии, а самостоятельная сущность результата.
export type DealStageGroupProps = {
    id: string;
    name: string;
};

export class DealStageGroup extends ValueObject<DealStageGroupProps> {
    getId() {
        return this.props.id;
    }

    getName() {
        return this.props.name;
    }
}
