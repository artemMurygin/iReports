import { Command, CommandProps } from '@/shared/domain/command.base';

// Выплата направления shop (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 12) — direction зафиксирован в хендлере ('shop'), не поле команды:
// эндпоинт живёт под /v1/shop/accounting/payout (направление уже в пути),
// тот же приём, что CreatePayoutCommand направления service (см.
// domains/service/modules/accounting/application/command/create-payout.command.ts)
// — это НЕ тот же класс: ErpCashDocumentPort не переиспользуется между
// доменами (SHOP_ERP_CASH_DOCUMENT_PORT/МойСклад vs
// SERVICE_ERP_CASH_DOCUMENT_PORT/RemOnline, см. backend/CLAUDE.md про
// изоляцию service/shop), поэтому у shop — собственный класс команды.
export class CreateShopPayoutCommand extends Command {
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

    constructor(props: CommandProps<CreateShopPayoutCommand>) {
        super(props);
        this.employeeId = props.employeeId;
        this.amount = props.amount;
        this.createdBy = props.createdBy;
        this.comment = props.comment;
        this.occurredAt = props.occurredAt;
        this.confirmNegativeBalance = props.confirmNegativeBalance;
    }
}
