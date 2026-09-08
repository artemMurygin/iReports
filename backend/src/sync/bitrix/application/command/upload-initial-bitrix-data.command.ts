import { Command, CommandProps } from '@/shared/domain/command.base';

export class UploadInitialBitrixDataCommand extends Command {
    readonly fromDate: Date;

    constructor(props: CommandProps<UploadInitialBitrixDataCommand>) {
        super(props);
        this.fromDate = props.fromDate;
    }
}
