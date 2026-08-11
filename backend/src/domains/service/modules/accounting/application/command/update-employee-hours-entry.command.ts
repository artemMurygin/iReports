import { Command, CommandProps } from '@/shared/domain/command.base';

export class UpdateEmployeeHoursEntryCommand extends Command {
    readonly entryId: string;
    readonly hours: number;

    constructor(props: CommandProps<UpdateEmployeeHoursEntryCommand>) {
        super(props);
        this.entryId = props.entryId;
        this.hours = props.hours;
    }
}
