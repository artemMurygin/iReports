import type { TargetRole, WorkScheduleStatus } from 'ireports-contracts';
import { Command, CommandProps } from '@/shared/domain/command.base';

export class UpsertWorkScheduleEntryCommand extends Command {
    readonly employeeId: number;
    readonly date: string;
    readonly status: WorkScheduleStatus;
    readonly hours?: number;
    readonly role?: TargetRole;

    constructor(props: CommandProps<UpsertWorkScheduleEntryCommand>) {
        super(props);
        this.employeeId = props.employeeId;
        this.date = props.date;
        this.status = props.status;
        this.hours = props.hours;
        this.role = props.role;
    }
}
