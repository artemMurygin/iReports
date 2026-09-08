import { Command, CommandProps } from '@/shared/domain/command.base';
import { CreateSalaryRuleProps } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

export class CreateMotivationSchemaCommand extends Command {
    readonly targetType: string;

    readonly targetId: number;

    readonly name: string;

    readonly rules: CreateSalaryRuleProps[];

    constructor(props: CommandProps<CreateMotivationSchemaCommand>) {
        super(props);
        this.targetType = props.targetType;
        this.targetId = props.targetId;
        this.name = props.name;
        this.rules = props.rules;
    }
}
