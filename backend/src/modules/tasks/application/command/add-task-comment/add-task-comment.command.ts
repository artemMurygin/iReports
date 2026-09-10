import { Command, CommandProps } from '@/shared/domain/command.base';

// POST /v1/tasks/:id/comments (architecture.md, AddTaskCommentService) —
// authorEmployeeId приходит УЖЕ резолвленным HTTP-слоем из
// req.user.employeeId (SessionAuthGuard), а не из тела запроса
// (contracts/commands/task.ts createTaskCommentRequestSchema не несёт это
// поле) — команда просто принимает готовое значение параметром, не решает,
// откуда оно взялось.
export class AddTaskCommentCommand extends Command {
    readonly taskId: string;
    readonly authorEmployeeId: number;
    readonly text: string;

    constructor(props: CommandProps<AddTaskCommentCommand>) {
        super(props);
        this.taskId = props.taskId;
        this.authorEmployeeId = props.authorEmployeeId;
        this.text = props.text;
    }
}
