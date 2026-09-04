import { Command, CommandProps } from '@/shared/domain/command.base';

// Выплата направления service (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 12) — direction зафиксирован в хендлере ('service'), не поле команды:
// эндпоинт живёт под /v1/service/accounting/payout (направление уже в пути),
// тот же приём, что CloseAccountingPeriodCommand/CloseAccountingPeriodHandler
// (см. domains/service/modules/accounting/application/command/
// close-accounting-period.handler.ts — там 'service' тоже строковый литерал
// внутри хендлера, а не поле команды). Симметричный класс
// CreatePayoutHandler для shop заводит собственную команду в своём домене —
// ErpCashDocumentPort НЕ переиспользуется между доменами (см.
// backend/CLAUDE.md), поэтому это не тот случай, что
// CreateBalanceTransactionCommand (общий эндпоинт на оба направления).
export class CreatePayoutCommand extends Command {
    readonly employeeId: number;
    // Абсолютная величина, > 0 (проверяется контрактом на границе HTTP и
    // BalanceTransaction.forPayout в домене).
    readonly amount: number;
    readonly createdBy: number;
    readonly comment?: string;
    readonly occurredAt?: Date;
    // Подтверждение выплаты при нулевом/отрицательном остатке или сумме
    // больше остатка (PRD 3, «В скоупе») — без него запрос отклоняется 409
    // с текущим остатком (см. PayoutConfirmationRequiredException).
    readonly confirmNegativeBalance?: boolean;

    constructor(props: CommandProps<CreatePayoutCommand>) {
        super(props);
        this.employeeId = props.employeeId;
        this.amount = props.amount;
        this.createdBy = props.createdBy;
        this.comment = props.comment;
        this.occurredAt = props.occurredAt;
        this.confirmNegativeBalance = props.confirmNegativeBalance;
    }
}
