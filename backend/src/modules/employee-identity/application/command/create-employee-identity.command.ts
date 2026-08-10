import { Command, CommandProps } from '@/shared/domain/command.base';
import {
    EmployeeIdentityType,
    ExternalSystem,
} from '../../domain/types/employee-identity.types';

export class CreateEmployeeIdentityCommand extends Command {
    readonly bitrixEmployeeId: number;
    readonly system: ExternalSystem;
    readonly identifierType: EmployeeIdentityType;
    readonly externalId: string;

    constructor(props: CommandProps<CreateEmployeeIdentityCommand>) {
        super(props);
        this.bitrixEmployeeId = props.bitrixEmployeeId;
        this.system = props.system;
        this.identifierType = props.identifierType;
        this.externalId = props.externalId;
    }
}
