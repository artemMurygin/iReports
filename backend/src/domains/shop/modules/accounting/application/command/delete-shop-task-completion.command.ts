import { Command, CommandProps } from '@/shared/domain/command.base';

export class DeleteShopTaskCompletionCommand extends Command {
    readonly taskCompletionId: string;

    constructor(props: CommandProps<DeleteShopTaskCompletionCommand>) {
        super(props);
        this.taskCompletionId = props.taskCompletionId;
    }
}
