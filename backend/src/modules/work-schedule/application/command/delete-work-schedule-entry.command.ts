import { Command, CommandProps } from '@/shared/domain/command.base';

export class DeleteWorkScheduleEntryCommand extends Command {
    readonly entryId: string;

    constructor(props: CommandProps<DeleteWorkScheduleEntryCommand>) {
        super(props);
        this.entryId = props.entryId;
    }
}
