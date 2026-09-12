import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentNotProvidedException } from '@/shared/exceptions';

// openspec/changes/replace-bitrix-task-integration, design.md решение 5 /
// architecture.md (Entities: SalaryTask) — независимая копия для
// направления shop (issue #57, зеркало domains/service/modules/accounting/
// domain/entities/salary-task/salary-task.entity.ts, не переиспользует ни
// класс, ни таблицу сервиса). Заменяет прежний ShopSalaryTask (задача
// Bitrix24, персистентная запись общей таблицы salary_tasks) — модель этого
// change (общая, доменно-агностичная сущность Task в src/modules/tasks) не
// хранит salaryRuleId/period/isRecurring вовсе (design.md решение 2), эта
// связь теперь живёт в самом SalaryRule.config.taskIdByPeriod.
//
// НЕ персистентная — не агрегат, таблицы под неё нет: конструируется прямо
// в task-completion-statuses.builder.ts на каждый расчёт (в т.ч. при
// пересчёте открытого периода), без класса-адаптера/маппера между ними.
export interface SalaryTaskProps {
    // Сырой код статуса, ПОЛУЧЕННЫЙ из данных Task (src/modules/tasks), не
    // через TaskStatus VO этого модуля — anti-corruption layer: accounting
    // сам, локально, решает, какой статус считается «выполненным» (см.
    // isCompleted() ниже), не делегируя это чужому VO.
    status: string;
}

export interface CreateSalaryTaskProps {
    // Identity этой сущности — id связанной Task, а не собственный
    // сгенерированный uuid (architecture.md: "taskId (identity)").
    taskId: string;
    status: string;
}

export class ShopSalaryTask extends Entity<SalaryTaskProps> {
    declare protected readonly _id: AggregateID;

    static create(props: CreateSalaryTaskProps): ShopSalaryTask {
        return new ShopSalaryTask({
            id: props.taskId,
            props: { status: props.status },
        });
    }

    get taskId(): string {
        return this.id;
    }

    get status(): string {
        return this.props.status;
    }

    // «Закрыта успешно» — окончательное, проверенное руководителем
    // завершение задачи (не путать с isFactAccrued() ниже — с
    // task-completion-progressive-visibility факт строки TaskCompletionShop
    // капает раньше, на «Выполнена», см. её комментарий). Бизнес-правило
    // описано ЗДЕСЬ, локально в accounting, а не делегируется в
    // TaskStatus/Task модуля tasks.
    isCompleted(): boolean {
        return this.props.status === 'CLOSED_SUCCESSFULLY';
    }

    // Implements FR2, FR3 of task-completion-progressive-visibility: факт
    // «капает» с момента, когда задача хотя бы раз достигла статуса
    // «Выполнена», и НЕ сбрасывается автоматически при последующих
    // переходах — DONE/CLOSED_SUCCESSFULLY/CLOSED_UNSUCCESSFULLY/REWORK все
    // достижимы ТОЛЬКО через «Выполнена», поэтому «не NEW и не IN_PROGRESS»
    // эквивалентно «уже было выполнено хотя бы раз» для этой, стейтлес по
    // текущему статусу, сущности. Если руководитель обнаружит, что работа
    // по факту не была доведена до конца, он поправит сумму вручную при
    // проведении начисления — это не автоматический откат.
    isFactAccrued(): boolean {
        return (
            this.props.status !== 'NEW' && this.props.status !== 'IN_PROGRESS'
        );
    }

    validate(): void {
        if (!this.props.status) {
            throw new ArgumentNotProvidedException(
                'Задача должна иметь статус (status)',
            );
        }
    }
}
