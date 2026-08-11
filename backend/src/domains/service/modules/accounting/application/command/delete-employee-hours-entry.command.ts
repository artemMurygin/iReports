import { Command, CommandProps } from '@/shared/domain/command.base';

export class DeleteEmployeeHoursEntryCommand extends Command {
    readonly entryId: string;

    constructor(props: CommandProps<DeleteEmployeeHoursEntryCommand>) {
        super(props);
        this.entryId = props.entryId;
    }
}
