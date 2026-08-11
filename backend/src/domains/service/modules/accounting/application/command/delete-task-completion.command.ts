import { Command, CommandProps } from '@/shared/domain/command.base';

export class DeleteTaskCompletionCommand extends Command {
    readonly taskCompletionId: string;

    constructor(props: CommandProps<DeleteTaskCompletionCommand>) {
        super(props);
        this.taskCompletionId = props.taskCompletionId;
    }
}
