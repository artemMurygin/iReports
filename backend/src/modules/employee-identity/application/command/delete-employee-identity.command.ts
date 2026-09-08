import { Command, CommandProps } from '@/shared/domain/command.base';

export class DeleteEmployeeIdentityCommand extends Command {
    readonly identityId: string;

    constructor(props: CommandProps<DeleteEmployeeIdentityCommand>) {
        super(props);
        this.identityId = props.identityId;
    }
}
