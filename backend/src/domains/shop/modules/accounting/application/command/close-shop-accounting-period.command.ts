import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/accounting/application/command/
// close-accounting-period.command.ts — независимая команда для направления
// shop. direction не поле команды: оно зафиксировано самим расположением
// класса в домене shop (см. CloseShopAccountingPeriodHandler), а не
// читается из запроса, как раньше (см. запрет на объединение доменов
// service/shop в backend/CLAUDE.md).
export class CloseShopAccountingPeriodCommand extends Command {
    readonly period: string;
    readonly closedBy: number;

    constructor(props: CommandProps<CloseShopAccountingPeriodCommand>) {
        super(props);
        this.period = props.period;
        this.closedBy = props.closedBy;
    }
}
