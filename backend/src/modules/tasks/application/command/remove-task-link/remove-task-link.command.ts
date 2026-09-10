import { Command, CommandProps } from '@/shared/domain/command.base';

// DELETE /v1/tasks/:id/links/:linkId (architecture.md, RemoveTaskLinkService).
export class RemoveTaskLinkCommand extends Command {
    readonly taskId: string;
    readonly linkId: string;

    constructor(props: CommandProps<RemoveTaskLinkCommand>) {
        super(props);
        this.taskId = props.taskId;
        this.linkId = props.linkId;
    }
}
