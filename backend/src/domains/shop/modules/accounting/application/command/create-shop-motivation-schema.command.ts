import { Command, CommandProps } from '@/shared/domain/command.base';
import { CreateShopSalaryRuleProps } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';

// Зеркало domains/service/modules/accounting/application/command/
// create-motivation-schema.command.ts (Фаза 13.5, issue #57) — независимая
// копия для направления shop.
export class CreateShopMotivationSchemaCommand extends Command {
    readonly targetType: string;

    readonly targetId: number;

    readonly name: string;

    readonly rules: CreateShopSalaryRuleProps[];

    constructor(props: CommandProps<CreateShopMotivationSchemaCommand>) {
        super(props);
        this.targetType = props.targetType;
        this.targetId = props.targetId;
        this.name = props.name;
        this.rules = props.rules;
    }
}
