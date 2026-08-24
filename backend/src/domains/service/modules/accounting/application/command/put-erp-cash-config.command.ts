import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Generic по direction — как ReopenAccountingPeriodCommand/
// RecalculateAccountingPeriodCommand: один хендлер, зарегистрированный один
// раз в AccountingModule сервиса, оба направления диспатчат эту же команду
// через общий CommandBus (см. Put*ErpCashConfigHttpController в
// domains/service и domains/shop). Поля не разбиты по направлению — их
// разделяет уже DTO на границе HTTP (put*ErpCashConfigRequestSchema из
// contracts): контроллер каждого направления передаёт в команду только
// свои поля, остальные остаются undefined и не трогают уже сохранённые
// значения (см. ErpCashConfig.update()).
export class PutErpCashConfigCommand extends Command {
    readonly direction: AccountingDirection;
    readonly roappCashboxId?: number;
    readonly moySkladExpenseItemId?: string;
    readonly moySkladIncomeItemId?: string;
    readonly organizationId?: string;

    constructor(props: CommandProps<PutErpCashConfigCommand>) {
        super(props);
        this.direction = props.direction;
        this.roappCashboxId = props.roappCashboxId;
        this.moySkladExpenseItemId = props.moySkladExpenseItemId;
        this.moySkladIncomeItemId = props.moySkladIncomeItemId;
        this.organizationId = props.organizationId;
    }
}
