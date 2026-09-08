import { Command, CommandProps } from '@/shared/domain/command.base';

// Удаление ошибочного ручного движения (PRD 2, Фаза 8b): запись исчезает
// из ленты, остаток пересчитывается (он — SUM ленты). Единственный способ
// исправить ручное движение без документа ERP — PATCH движения не
// существует. Баланс общий по сотруднику, эндпоинт без направления в пути,
// поэтому направления нет и в команде — движение находится по id.
export class DeleteBalanceTransactionCommand extends Command {
    readonly transactionId: string;

    constructor(props: CommandProps<DeleteBalanceTransactionCommand>) {
        super(props);
        this.transactionId = props.transactionId;
    }
}
