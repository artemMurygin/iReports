import { Command, CommandProps } from '@/shared/domain/command.base';
import { CreateShopSalaryRuleProps } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

// Зеркало domains/service/modules/accounting/application/command/
// update-motivation-schema.command.ts (Фаза "Редактирование зарплатных
// схем", issue #57) — независимая копия для направления shop.
export class UpdateShopMotivationSchemaCommand extends Command {
    readonly motivationSchemaId: string;

    readonly name: string;

    readonly rules: CreateShopSalaryRuleProps[];

    constructor(props: CommandProps<UpdateShopMotivationSchemaCommand>) {
        super(props);
        this.motivationSchemaId = props.motivationSchemaId;
        this.name = props.name;
        this.rules = props.rules;
    }
}
