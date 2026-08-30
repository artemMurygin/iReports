import { Command, CommandProps } from '@/shared/domain/command.base';
import { CreateShopSalaryRuleProps } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

// Зеркало domains/service/modules/accounting/application/command/
// create-salary-rule.command.ts (Фаза 13.5, issue #57) — независимая копия
// для направления shop.
export class CreateShopSalaryRuleCommand extends Command {
    readonly motivationSchemaId: string;

    readonly rule: CreateShopSalaryRuleProps;

    constructor(props: CommandProps<CreateShopSalaryRuleCommand>) {
        super(props);
        this.motivationSchemaId = props.motivationSchemaId;
        this.rule = props.rule;
    }
}
