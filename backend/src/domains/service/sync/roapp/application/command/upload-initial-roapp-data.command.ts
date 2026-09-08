import { Command, CommandProps } from '@/shared/domain/command.base';

export class UploadInitialRoappDataCommand extends Command {
    readonly fromDate: Date;

    constructor(props: CommandProps<UploadInitialRoappDataCommand>) {
        super(props);
        this.fromDate = props.fromDate;
    }
}
