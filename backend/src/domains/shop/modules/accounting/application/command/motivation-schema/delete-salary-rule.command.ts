import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/accounting'ного DeleteSalaryRuleCommand
// (независимая копия) — DELETE .../salary-rules/:ruleId направления shop
// (add-task-rule-task-lifecycle), см. WHY в DeleteShopSalaryRuleHandler.
export class DeleteShopSalaryRuleCommand extends Command {
    readonly ruleId: string;

    constructor(props: CommandProps<DeleteShopSalaryRuleCommand>) {
        super(props);
        this.ruleId = props.ruleId;
    }
}
