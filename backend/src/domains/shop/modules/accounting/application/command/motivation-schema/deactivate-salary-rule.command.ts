import { Command, CommandProps } from '@/shared/domain/command.base';

// Soft-деактивация зарплатного правила направления shop (см. WHY у
// ShopSalaryRule.isActive, prisma/schema/salary.prisma) — POST
// .../salary-rules/:ruleId/deactivate. Зеркало
// domains/service/modules/accounting'ного DeactivateSalaryRuleCommand
// (независимая копия, issue #57).
export class DeactivateShopSalaryRuleCommand extends Command {
    readonly ruleId: string;

    constructor(props: CommandProps<DeactivateShopSalaryRuleCommand>) {
        super(props);
        this.ruleId = props.ruleId;
    }
}
