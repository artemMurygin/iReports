import { Command, CommandProps } from '@/shared/domain/command.base';

// POST .../salary-rules/:ruleId/activate — обратная операция к
// DeactivateSalaryRuleCommand: возвращает правило направления service в
// активное состояние (снова участвует в расчётах и видно в ответе GET
// .../motivation-schema/:id).
export class ReactivateSalaryRuleCommand extends Command {
    readonly ruleId: string;

    constructor(props: CommandProps<ReactivateSalaryRuleCommand>) {
        super(props);
        this.ruleId = props.ruleId;
    }
}
