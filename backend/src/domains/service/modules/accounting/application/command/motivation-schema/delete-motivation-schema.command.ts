import { Command, CommandProps } from '@/shared/domain/command.base';

// Implements FR1 of delete-motivation-schema.
export class DeleteMotivationSchemaCommand extends Command {
    readonly schemaId: string;

    constructor(props: CommandProps<DeleteMotivationSchemaCommand>) {
        super(props);
        this.schemaId = props.schemaId;
    }
}
