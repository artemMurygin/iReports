import { Command, CommandProps } from '@/shared/domain/command.base';

// Реактивация ранее деактивированного зарплатного правила направления shop
// (см. WHY у ShopSalaryRule.isActive) — POST .../salary-rules/:ruleId/activate.
// Зеркало domains/service/modules/accounting'ного
// ReactivateSalaryRuleCommand (независимая копия, issue #57).
export class ReactivateShopSalaryRuleCommand extends Command {
    readonly ruleId: string;

    constructor(props: CommandProps<ReactivateShopSalaryRuleCommand>) {
        super(props);
        this.ruleId = props.ruleId;
    }
}
