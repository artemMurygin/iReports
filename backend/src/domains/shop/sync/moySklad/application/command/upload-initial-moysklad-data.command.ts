import { Command, CommandProps } from '@/shared/domain/command.base';

export class UploadInitialMoySkladDataCommand extends Command {
    readonly fromDate: Date;

    constructor(props: CommandProps<UploadInitialMoySkladDataCommand>) {
        super(props);
        this.fromDate = props.fromDate;
    }
}
