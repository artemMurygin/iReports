import { ValueObject } from '@/shared/domain/value-object.base';

// Ответственный менеджер сделки для read-модели списка сделок (deal list,
// GET /v1/service/sales/deals) — подмножество полей BitrixEmployee
// (id/firstName/lastName), которое реально нужно этому списку; остальные
// поля BitrixEmployee (departmentId, идентичности во внешних ERP) сюда не
// входят.
export type DealAssigneeProps = {
    id: number;
    firstName: string;
    lastName: string;
};

export class DealAssignee extends ValueObject<DealAssigneeProps> {
    getId() {
        return this.props.id;
    }

    getFirstName() {
        return this.props.firstName;
    }

    getLastName() {
        return this.props.lastName;
    }
}
