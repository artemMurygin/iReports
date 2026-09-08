import { Command, CommandProps } from '@/shared/domain/command.base';
import type { TaskStatusCode } from '@/modules/tasks/domain/value-objects/task-status.value-object';

// HTTP-вход self-service переходов ответственного/руководителя
// (specs/tasks/spec.md, Requirements «Ответственный сотрудник ведёт задачу
// до готовности» / «Проверка и закрытие задачи руководителем» / «Возврат с
// доработки в работу»). RBAC не вводится в этом change (см. tasks.md) —
// actorEmployeeId принят по сигнатуре architecture.md, хендлер его не
// использует для авторизации, только сам граф переходов.
export class ChangeTaskStatusCommand extends Command {
    readonly taskId: string;
    readonly targetStatus: TaskStatusCode;
    readonly actorEmployeeId: number;

    constructor(props: CommandProps<ChangeTaskStatusCommand>) {
        super(props);
        this.taskId = props.taskId;
        this.targetStatus = props.targetStatus;
        this.actorEmployeeId = props.actorEmployeeId;
    }
}
