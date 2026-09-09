import { Command, CommandProps } from '@/shared/domain/command.base';

// Раздел 18 tasks.md (add-task-based-salary-rule) — зеркало
// domains/service/modules/accounting/application/command/
// set-task-completion-line-reward.command.ts: первичный ручной ввод
// суммы+комментария строки TaskCompletion (design.md Decision 5), по образцу
// AdjustShopSalaryAccrualLineCommand — независимая команда для направления
// shop (issue #57), без adjustedBy (см. комментарий в
// contracts/commands/salary-accrual.ts, setTaskCompletionLineRewardRequestSchema:
// первичный ввод, а не корректировка уже посчитанного значения). В отличие
// от сервисной SetTaskCompletionLineRewardCommand — без поля direction: оно
// не generic по направлению, направление зафиксировано самим тем, что
// ShopSalaryAccrualRepositoryPort всегда фильтрует 'shop'.
export class SetShopTaskCompletionLineRewardCommand extends Command {
    readonly accrualId: string;
    readonly lineId: string;
    readonly amount: number;
    readonly comment: string;

    constructor(props: CommandProps<SetShopTaskCompletionLineRewardCommand>) {
        super(props);
        this.accrualId = props.accrualId;
        this.lineId = props.lineId;
        this.amount = props.amount;
        this.comment = props.comment;
    }
}
