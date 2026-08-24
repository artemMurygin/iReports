import { randomUUID } from 'crypto';
import { GetEmployeeBalanceService } from './get-employee-balance.service';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import type { BalanceTransactionProps } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { InMemoryBalanceTransactionRepository } from '@/domains/service/modules/accounting/testing/in-memory-balance-transaction.repository';
import { InMemoryErpCashDocumentRepository } from '@/domains/service/modules/accounting/testing/in-memory-erp-cash-document.repository';
import { ErpCashDocument } from '@/domains/service/modules/accounting/domain/entities/erp-cash-document.entity';

// Общий баланс сотрудника (PRD 2, Фаза 8b): остаток = SUM ВСЕЙ ленты
// сотрудника независимо от направления движений — проверяется на смешанной
// ленте с движениями service и shop; фильтры не влияют на остаток, но дают
// итог по выборке; строка ленты не раскрывается — у движения начисления
// есть ссылка на документ (accrualId).
describe('GetEmployeeBalanceService', () => {
    const transaction = (
        overrides: Partial<BalanceTransactionProps> & { amount: number },
    ) =>
        withRequestContext(
            () =>
                new BalanceTransaction({
                    id: randomUUID(),
                    props: {
                        employeeId: 42,
                        direction: 'service',
                        type: 'BONUS',
                        occurredAt: new Date('2026-07-15'),
                        createdBy: 7,
                        erpSyncRequired: false,
                        ...overrides,
                    },
                }),
        );

    const build = () => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const erpCashDocumentRepo = new InMemoryErpCashDocumentRepository();
        const service = new GetEmployeeBalanceService(
            transactionRepo,
            erpCashDocumentRepo,
        );
        return { service, transactionRepo, erpCashDocumentRepo };
    };

    it('остаток = SUM всей ленты сотрудника независимо от направления движений; чужой сотрудник не учитывается', async () => {
        const { service, transactionRepo } = build();
        await transactionRepo.insertMany([
            transaction({ amount: 2000 }),
            transaction({ amount: -500, type: 'ADVANCE' }),
            transaction({ amount: 300, type: 'SICK_LEAVE' }),
            transaction({
                amount: -100,
                type: 'PENALTY',
                comment: 'Опоздание',
            }),
            // Движение направления shop — В ТОМ ЖЕ остатке: баланс общий,
            // direction — лишь атрибут происхождения (Фаза 8b).
            transaction({ amount: 1000, direction: 'shop' }),
            // Другой сотрудник — не в остатке 42-го.
            transaction({ amount: 7777, employeeId: 43 }),
        ]);

        const response = await service.execute(42, {});

        expect(response.balance).toBe(2000 - 500 + 300 - 100 + 1000);
        expect(response.selectionTotal).toBe(response.balance);
        expect(response.transactions).toHaveLength(5);
        expect(response.employeeId).toBe(42);
    });

    it('сотрудник без движений — остаток 0 и пустая лента, не ошибка', async () => {
        const { service } = build();
        const response = await service.execute(42, {});
        expect(response).toMatchObject({
            balance: 0,
            selectionTotal: 0,
            transactions: [],
        });
    });

    it('фильтры по типам и датам сужают ленту и итог по выборке, но не остаток', async () => {
        const { service, transactionRepo } = build();
        await transactionRepo.insertMany([
            transaction({
                amount: 2000,
                occurredAt: new Date('2026-07-10'),
            }),
            transaction({
                amount: -500,
                type: 'ADVANCE',
                occurredAt: new Date('2026-07-20'),
            }),
            transaction({
                amount: -300,
                type: 'ADVANCE',
                direction: 'shop',
                occurredAt: new Date('2026-08-05'),
            }),
        ]);

        const byType = await service.execute(42, {
            types: ['ADVANCE'],
        });
        expect(byType.balance).toBe(1200);
        expect(byType.selectionTotal).toBe(-800);
        expect(byType.transactions).toHaveLength(2);

        const byRange = await service.execute(42, {
            from: new Date('2026-07-01'),
            to: new Date('2026-07-31'),
        });
        expect(byRange.selectionTotal).toBe(1500);
        expect(byRange.transactions).toHaveLength(2);
    });

    it('движение начисления несёт ссылку на документ (accrualId), лента не раскрывается', async () => {
        const { service, transactionRepo } = build();
        const accrual = withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 2000,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        quantity: 8,
                        rate: 250,
                        amount: 2000,
                        sources: [{ type: 'order', id: 'order-1' }],
                    },
                ],
            }),
        );
        const line = accrual.lines[0];
        await transactionRepo.insertMany(
            withRequestContext(() =>
                BalanceTransaction.forAccruedLine(accrual, line, 7),
            ),
        );

        const response = await service.execute(42, {});

        expect(response.transactions).toHaveLength(1);
        expect(response.transactions[0]).toMatchObject({
            type: 'SALARY_ACCRUAL',
            amount: 2000,
            accrualId: accrual.id,
            lineId: line.id,
            ruleId: 'rule-1',
        });
        // Детализация начисления живёт в документе — в ответе ленты нет
        // раскрытия строки (Фаза 8b).
        expect(response.transactions[0]).not.toHaveProperty('accrualLine');
    });

    // PRD 3 (docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md),
    // «Критерии готовности»: «Внешний ID документа ERP сохраняется и
    // показывается в ленте баланса».
    it('движение с документом ERP несёт system/externalId в поле erp; движение без документа — erp: null', async () => {
        const { service, transactionRepo, erpCashDocumentRepo } = build();
        const withErp = transaction({
            amount: -1000,
            type: 'ADVANCE',
            erpSyncRequired: true,
        });
        const withoutErp = transaction({ amount: 500, type: 'BONUS' });
        await transactionRepo.insertMany([withErp, withoutErp]);
        await erpCashDocumentRepo.insert(
            ErpCashDocument.create({
                transactionId: withErp.id,
                system: 'ROAPP',
                kind: 'OUTCOME',
                amount: 1000,
                externalId: 'erp-ext-99',
            }),
        );

        const response = await service.execute(42, {});

        const erpRow = response.transactions.find((t) => t.id === withErp.id);
        const plainRow = response.transactions.find(
            (t) => t.id === withoutErp.id,
        );
        expect(erpRow!.erp).toEqual({
            system: 'ROAPP',
            externalId: 'erp-ext-99',
        });
        expect(plainRow!.erp).toBeNull();
    });
});
