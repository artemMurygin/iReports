import { randomUUID } from 'crypto';
import {
    AggregateID,
    CreateEntityProps,
    Entity,
} from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { TaskStatus } from '../value-objects/task-status.value-object';
import { InvalidTaskTransitionException } from '../exceptions/task.exception';

// specs/tasks/spec.md, Requirement: «Задача — полностью самостоятельная
// сущность, не знающая о зарплатных правилах» — design.md Decision 2:
// Task физически не хранит и не может хранить salaryRuleId/period/
// isRecurring, это понятия зарплатного расчёта, не задачи как таковой (см.
// TaskCreateProps ниже — там намеренно нет таких полей). Связь «правило ↔
// задача за период» хранит и обслуживает само зарплатное правило
// (TaskCompletionSalaryConfig.taskIdByPeriod, domains/{service,shop}/
// modules/accounting), не эта сущность.
export interface TaskProps {
    // design.md Decision 2: атрибут происхождения для фильтрации в общем
    // /tasks (по прецеденту BalanceTransaction.direction) — НЕ участвует в
    // связи с зарплатным правилом.
    direction: AccountingDirection | null;
    title: string;
    description: string | null;
    deadline: Date;
    assigneeEmployeeId: number;
    status: TaskStatus;
    closedSuccessfullyAt: Date | null;
}

export interface TaskCreateProps {
    title: string;
    description?: string | null;
    deadline: Date;
    assigneeEmployeeId: number;
    direction?: AccountingDirection | null;
}

export class Task extends Entity<TaskProps> {
    declare protected readonly _id: AggregateID;

    static create(props: TaskCreateProps): Task {
        return new Task({
            id: randomUUID(),
            props: {
                title: props.title,
                description: props.description ?? null,
                deadline: props.deadline,
                assigneeEmployeeId: props.assigneeEmployeeId,
                direction: props.direction ?? null,
                status: TaskStatus.new(),
                closedSuccessfullyAt: null,
            },
        });
    }

    // Восстановление из персистентности — отдельный вход, чтобы маппер не
    // зависел от формы конструктора базового класса (тот же приём, что
    // WorkScheduleEntry.reconstitute).
    static reconstitute(props: CreateEntityProps<TaskProps>): Task {
        return new Task(props);
    }

    get direction(): AccountingDirection | null {
        return this.props.direction;
    }

    get title(): string {
        return this.props.title;
    }

    get description(): string | null {
        return this.props.description;
    }

    get deadline(): Date {
        return this.props.deadline;
    }

    get assigneeEmployeeId(): number {
        return this.props.assigneeEmployeeId;
    }

    get status(): TaskStatus {
        return this.props.status;
    }

    get closedSuccessfullyAt(): Date | null {
        return this.props.closedSuccessfullyAt;
    }

    // specs/tasks/spec.md, Requirement: «Жизненный цикл статуса задачи».
    // actorEmployeeId — кто инициировал переход (ответственный/
    // руководитель); RBAC в этом change не вводится (см. tasks.md,
    // "Решения, зафиксированные перед написанием этого списка") — метод
    // проверяет ТОЛЬКО сам граф переходов (TaskStatus.canTransitionTo), не
    // то, имеет ли actorEmployeeId право его совершать. Параметр принят по
    // сигнатуре architecture.md (для будущего аудита/логирования) — сейчас
    // не персистится (Task в этой итерации не хранит историю переходов).
    transitionTo(next: TaskStatus, _actorEmployeeId: number): void {
        if (!this.props.status.canTransitionTo(next)) {
            throw new InvalidTaskTransitionException(
                `Недопустимый переход задачи из "${this.props.status.code}" в "${next.code}"`,
            );
        }
        this.props.status = next;
        // design.md Decision 3: только CLOSED_SUCCESSFULLY запускает
        // начисление правила TaskCompletion — closedSuccessfullyAt
        // фиксирует именно этот момент, любой другой переход его не трогает.
        if (next.code === 'CLOSED_SUCCESSFULLY') {
            this.props.closedSuccessfullyAt = new Date();
        }
    }

    // specs/tasks/spec.md, Requirement: «Отмена правила закрывает
    // незавершённую задачу как неуспешную» — design.md Decision 3, «Отмена
    // при удалении правила»: системный переход, который НАМЕРЕННО не идёт
    // через transitionTo()/canTransitionTo() — self-service граф разрешает
    // CLOSED_UNSUCCESSFULLY только из DONE, а здесь незавершённая задача в
    // ЛЮБОМ нетерминальном статусе (NEW/IN_PROGRESS/DONE/REWORK) должна
    // закрываться неуспешно при удалении/отмене её зарплатного правила.
    // No-op, если задача уже терминальна (CLOSED_SUCCESSFULLY или
    // CLOSED_UNSUCCESSFULLY) — статус не меняется.
    cancelForRuleDeletion(): void {
        if (this.props.status.isTerminal()) {
            return;
        }
        this.props.status = TaskStatus.closedUnsuccessfully();
        // Терминальный переход, инициированный системой, а не проверкой
        // руководителя — closedSuccessfullyAt намеренно не проставляется
        // (это не CLOSED_SUCCESSFULLY).
    }

    validate(): void {
        if (!this.props.title || this.props.title.trim().length === 0) {
            throw new ArgumentInvalidException(
                'Название задачи не может быть пустым',
            );
        }
        if (
            !Number.isInteger(this.props.assigneeEmployeeId) ||
            this.props.assigneeEmployeeId <= 0
        ) {
            throw new ArgumentInvalidException(
                'Необходимо указать корректного ответственного сотрудника задачи',
            );
        }
    }
}
