import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

// replace-bitrix-task-integration, design.md решение 5 (пересмотрено
// пользователем дважды — Port/Adapter поверх этого признан избыточной
// церемонией): доменная Entity accounting поверх сырых данных
// src/modules/tasks, БЕЗ Port/Adapter. Создаётся ПРЯМО в момент получения
// Task[] от TASK_REPOSITORY.findManyByIds() (task-completion-statuses.builder.ts,
// без промежуточного класса-переводчика) — не персистентная, таблицы под
// неё нет, пересоздаётся заново на каждый расчёт (в т.ч. при пересчёте
// открытого периода).
export interface CreateSalaryTaskProps {
    taskId: string;
    status: string;
}

export interface SalaryTaskProps {
    status: string;
}

export class SalaryTask extends Entity<SalaryTaskProps> {
    declare protected readonly _id: AggregateID;

    // identity — сам taskId (id связанной Task модуля tasks), а не
    // сгенерированный uuid: SalaryTask не самостоятельная сущность, а
    // локальное представление одной конкретной Task для нужд accounting.
    static create(props: CreateSalaryTaskProps): SalaryTask {
        return new SalaryTask({
            id: props.taskId,
            props: { status: props.status },
        });
    }

    get taskId(): string {
        return this.id;
    }

    // Сырой код статуса ('NEW'/'IN_PROGRESS'/'DONE'/'CLOSED_SUCCESSFULLY'/
    // 'CLOSED_UNSUCCESSFULLY'/'REWORK'), ПОЛУЧЕННЫЙ из данных tasks — не
    // через TaskStatus VO модуля tasks (design.md решение 5: accounting сам,
    // локально, знает и проверяет нужный код статуса).
    get status(): string {
        return this.props.status;
    }

    // «Закрыта успешно» — окончательное, проверенное руководителем
    // завершение задачи (не путать с isFactAccrued() ниже — с
    // task-completion-progressive-visibility факт строки TaskCompletion
    // капает раньше, на «Выполнена», см. её комментарий). Бизнес-правило
    // описано ЗДЕСЬ, локально, не делегируется в TaskStatus.isTerminal()/
    // чужой код модуля tasks.
    isCompleted(): boolean {
        return this.props.status === 'CLOSED_SUCCESSFULLY';
    }

    // Implements FR2, FR3 of task-completion-progressive-visibility:
    // факт «капает» с момента, когда задача хотя бы раз достигла статуса
    // «Выполнена», и НЕ сбрасывается автоматически при последующих переходах
    // — DONE/CLOSED_SUCCESSFULLY/CLOSED_UNSUCCESSFULLY/REWORK все достижимы
    // ТОЛЬКО через «Выполнена» (см. TRANSITIONS в
    // task-status.value-object.ts), поэтому «не NEW и не IN_PROGRESS»
    // эквивалентно «уже было выполнено хотя бы раз» для этой, стейтлес по
    // текущему статусу, сущности. Если руководитель обнаружит, что работа по
    // факту не была доведена до конца, он поправит сумму вручную при
    // проведении начисления (SetTaskCompletionLineReward) — это не
    // автоматический откат.
    isFactAccrued(): boolean {
        return (
            this.props.status !== 'NEW' && this.props.status !== 'IN_PROGRESS'
        );
    }

    validate(): void {
        if (!this.id) {
            throw new ArgumentInvalidException('Задача должна иметь taskId');
        }
        if (!this.props.status) {
            throw new ArgumentInvalidException(
                'Задача должна иметь статус (status)',
            );
        }
    }
}
