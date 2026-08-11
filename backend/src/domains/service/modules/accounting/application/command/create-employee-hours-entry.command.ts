import { Command, CommandProps } from '@/shared/domain/command.base';

export class CreateEmployeeHoursEntryCommand extends Command {
    readonly employeeId: number;
    readonly period: string;
    readonly hours: number;

    constructor(props: CommandProps<CreateEmployeeHoursEntryCommand>) {
        super(props);
        this.employeeId = props.employeeId;
        this.period = props.period;
        this.hours = props.hours;
    }
}
