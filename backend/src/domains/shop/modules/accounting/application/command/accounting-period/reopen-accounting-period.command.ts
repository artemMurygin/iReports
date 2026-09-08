import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/accounting/application/command/
// reopen-accounting-period.command.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая команда для направления shop, без поля direction: оно
// зафиксировано расположением класса (см. ReopenShopAccountingPeriodHandler),
// тот же приём, что у CloseShopAccountingPeriodCommand (Фаза 13.5). confirm
// проверяется на границе HTTP (reopenAccountingPeriodRequestSchema), но
// команда осталась без него — переоткрытие shop сейчас безусловное на
// уровне команды, подтверждение — обязанность контроллера (см.
// ReopenShopAccountingPeriodHttpController).
export class ReopenShopAccountingPeriodCommand extends Command {
    readonly period: string;

    constructor(props: CommandProps<ReopenShopAccountingPeriodCommand>) {
        super(props);
        this.period = props.period;
    }
}
