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

    // Бизнес-правило accounting «что считается выполненным для целей
    // начисления» — описано ЗДЕСЬ, локально, не делегируется в
    // TaskStatus.isTerminal()/чужой код модуля tasks (design.md решение 3:
    // только «Закрыта успешно» запускает начисление правила TaskCompletion,
    // НЕ «Выполнена» и не любой другой терминальный статус).
    isCompleted(): boolean {
        return this.props.status === 'CLOSED_SUCCESSFULLY';
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
