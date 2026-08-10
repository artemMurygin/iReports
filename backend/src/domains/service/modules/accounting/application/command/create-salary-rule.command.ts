import { Command, CommandProps } from '@/shared/domain/command.base';
import { CreateSalaryRuleProps } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

export class CreateSalaryRuleCommand extends Command {
    readonly motivationSchemaId: string;

    readonly rule: CreateSalaryRuleProps;

    constructor(props: CommandProps<CreateSalaryRuleCommand>) {
        super(props);
        this.motivationSchemaId = props.motivationSchemaId;
        this.rule = props.rule;
    }
}
