import { Command, CommandProps } from '@/shared/domain/command.base';

// POST /v1/tasks/:id/links (architecture.md, AddTaskLinkService).
export class AddTaskLinkCommand extends Command {
    readonly taskId: string;
    readonly url: string;
    readonly label?: string;

    constructor(props: CommandProps<AddTaskLinkCommand>) {
        super(props);
        this.taskId = props.taskId;
        this.url = props.url;
        this.label = props.label;
    }
}
