import { Command, CommandProps } from '@/shared/domain/command.base';

// openspec/changes/edit-task/specs/tasks/spec.md, Requirement:
// «Редактирование полей активной задачи» — HTTP-вход PATCH /v1/tasks/:id.
// Все поля, кроме taskId, опциональны (частичный патч, тот же приём, что
// Task.update: неуказанное поле не трогается).
export class UpdateTaskCommand extends Command {
    readonly taskId: string;
    readonly title?: string;
    readonly description?: string;
    readonly deadline?: Date;
    readonly assigneeEmployeeId?: number;

    constructor(props: CommandProps<UpdateTaskCommand>) {
        super(props);
        this.taskId = props.taskId;
        this.title = props.title;
        this.description = props.description;
        this.deadline = props.deadline;
        this.assigneeEmployeeId = props.assigneeEmployeeId;
    }
}
