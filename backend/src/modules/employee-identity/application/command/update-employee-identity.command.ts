import { Command, CommandProps } from '@/shared/domain/command.base';
import { EmployeeIdentityType } from '../../domain/types/employee-identity.types';

export class UpdateEmployeeIdentityCommand extends Command {
    readonly identityId: string;
    readonly identifierType?: EmployeeIdentityType;
    readonly externalId?: string;

    constructor(props: CommandProps<UpdateEmployeeIdentityCommand>) {
        super(props);
        this.identityId = props.identityId;
        this.identifierType = props.identifierType;
        this.externalId = props.externalId;
    }
}
