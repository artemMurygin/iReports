import { Command, CommandProps } from '@/shared/domain/command.base';

// Ручной ввод фактической суммы по закрытой задаче (spec.md, "Ручной ввод
// фактической суммы по закрытой задаче") — доступно только на странице
// зарплатного отчёта сотрудника за открытый расчётный период, только для
// правила-задачи в статусе "Закрыта".
export class SetTaskRuleActualAmountCommand extends Command {
    readonly ruleId: string;

    readonly period: string;

    readonly actualAmount: number;

    constructor(props: CommandProps<SetTaskRuleActualAmountCommand>) {
        super(props);
        this.ruleId = props.ruleId;
        this.period = props.period;
        this.actualAmount = props.actualAmount;
    }
}
