import { ValueObject } from '@/shared/domain/value-object.base';

// Стадия сделки для read-модели списка сделок (deal list, GET
// /v1/service/sales/deals) — НЕ переиспользует Stage
// (stage.value-object.ts): тот VO обслуживает другую read-модель (воронка
// лидов, LeadEntity) и намеренно уже (id/name/group). Список сделок должен
// отдавать полную форму BitrixStage (кроме entityId — служебное поле, не
// нужное потребителю), поэтому это отдельный тип, а не расширение Stage.
export type DealListStageProps = {
    id: string;
    name: string;
    sort: number;
    color: string;
    systemType: string;
    stageGroupId: string | null;
    stageGroupName: string | null;
};

export class DealListStage extends ValueObject<DealListStageProps> {
    getId() {
        return this.props.id;
    }

    getName() {
        return this.props.name;
    }

    getSort() {
        return this.props.sort;
    }

    getColor() {
        return this.props.color;
    }

    getSystemType() {
        return this.props.systemType;
    }

    getStageGroupId() {
        return this.props.stageGroupId;
    }

    getStageGroupName() {
        return this.props.stageGroupName;
    }
}
