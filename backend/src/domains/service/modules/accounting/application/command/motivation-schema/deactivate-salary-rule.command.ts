import { Command, CommandProps } from '@/shared/domain/command.base';

// POST .../salary-rules/:ruleId/deactivate — soft-деактивация ОДНОГО правила
// направления service: правило перестаёт участвовать в расчётах
// (mergeEmployeeSalaryRules) и пропадает из ответа GET
// .../motivation-schema/:id, но не удаляется физически — история его
// начислений сохраняется. В отличие от DeleteSalaryRuleCommand, никак не
// затрагивает связанные задачи (TaskCompletion) — осознанное решение
// продукта: деактивация не должна отменять/удалять уже поставленную задачу.
export class DeactivateSalaryRuleCommand extends Command {
    readonly ruleId: string;

    constructor(props: CommandProps<DeactivateSalaryRuleCommand>) {
        super(props);
        this.ruleId = props.ruleId;
    }
}
