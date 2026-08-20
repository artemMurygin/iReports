import { Command, CommandProps } from '@/shared/domain/command.base';
import { CreateSalaryRuleProps } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

export class UpdateMotivationSchemaCommand extends Command {
    readonly motivationSchemaId: string;

    readonly name: string;

    readonly rules: CreateSalaryRuleProps[];

    constructor(props: CommandProps<UpdateMotivationSchemaCommand>) {
        super(props);
        this.motivationSchemaId = props.motivationSchemaId;
        this.name = props.name;
        this.rules = props.rules;
    }
}
