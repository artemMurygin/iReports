import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/accounting/application/command/
// motivation-schema/delete-motivation-schema.command.ts — независимая копия
// для направления shop. Implements FR2 of delete-motivation-schema.
export class DeleteShopMotivationSchemaCommand extends Command {
    readonly schemaId: string;

    constructor(props: CommandProps<DeleteShopMotivationSchemaCommand>) {
        super(props);
        this.schemaId = props.schemaId;
    }
}
