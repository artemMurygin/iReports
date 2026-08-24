import { CqrsModule, CommandBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { ERP_CASH_DOCUMENT_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import { SHOP_ERP_CASH_DOCUMENT_PORT } from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import type {
    CreateErpCashDocumentParams,
    DeleteErpCashDocumentParams,
    ErpCashDocumentPort,
} from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { InMemoryBalanceTransactionRepository } from '@/domains/service/modules/accounting/testing/in-memory-balance-transaction.repository';
import { InMemoryErpCashDocumentRepository } from '@/domains/service/modules/accounting/testing/in-memory-erp-cash-document.repository';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/testing/in-memory-salary-accrual.repository';
import { CreateShopPayoutHandler } from './create-shop-payout.handler';
import { CreateShopPayoutBatchHandler } from './create-shop-payout-batch.handler';
import { CreateShopPayoutBatchCommand } from './create-shop-payout-batch.command';

// Массовая выплата направления shop (PRD 3, «День выплаты») — зеркалит
// create-payout-batch.handler.spec.ts направления service: результат —
// перечень PAID/NEEDS_CONFIRMATION/FAILED, один упавший сотрудник не
// прерывает остальных. CreateShopPayoutHandler зарегистрирован на реальном
// CommandBus (через CqrsModule), чтобы проверить именно диспатч, а не
// подмену.
describe('CreateShopPayoutBatchHandler', () => {
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        findEmployees: () =>
            Promise.resolve([
                {
                    id: 1,
                    firstName: 'Иван',
                    lastName: 'Петров',
                    departmentId: 5,
                },
                {
                    id: 2,
                    firstName: 'Пётр',
                    lastName: 'Сидоров',
                    departmentId: 5,
                },
                {
                    id: 3,
                    firstName: 'Анна',
                    lastName: 'Смирнова',
                    departmentId: 5,
                },
            ]),
    };

    const build = async (erpPort: ErpCashDocumentPort) => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const erpCashDocumentRepo = new InMemoryErpCashDocumentRepository();
        const unitOfWork: UnitOfWorkPort = { run: (work) => work() };

        const moduleRef = await Test.createTestingModule({
            imports: [CqrsModule],
            providers: [
                CreateShopPayoutHandler,
                CreateShopPayoutBatchHandler,
                {
                    provide: BALANCE_TRANSACTION_REPOSITORY,
                    useValue: transactionRepo,
                },
                { provide: SALARY_ACCRUAL_REPOSITORY, useValue: accrualRepo },
                { provide: SHOP_ERP_CASH_DOCUMENT_PORT, useValue: erpPort },
                {
                    provide: ERP_CASH_DOCUMENT_REPOSITORY,
                    useValue: erpCashDocumentRepo,
                },
                { provide: DIRECTORY_REPOSITORY, useValue: fakeDirectoryRepo },
                { provide: UNIT_OF_WORK, useValue: unitOfWork },
                EmployeeOperationLock,
            ],
        }).compile();

        await moduleRef.init();
        const commandBus = moduleRef.get(CommandBus);
        const batchHandler = moduleRef.get(CreateShopPayoutBatchHandler);
        return { commandBus, batchHandler, transactionRepo };
    };

    it('частичный успех: PAID / NEEDS_CONFIRMATION (нулевой остаток) / FAILED (ошибка ERP)', async () => {
        const erpPort: ErpCashDocumentPort = {
            create: (params: CreateErpCashDocumentParams) => {
                if (params.employeeId === 3) {
                    return Promise.reject(new Error('МойСклад недоступен'));
                }
                return Promise.resolve({
                    externalId: `erp-${params.employeeId}`,
                });
            },
            delete: (_p: DeleteErpCashDocumentParams) => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const { batchHandler, transactionRepo } = await build(erpPort);

        // Сотрудник 1 — есть остаток (будет PAID), сотрудник 2 — остаток 0
        // (NEEDS_CONFIRMATION), сотрудник 3 — есть остаток, но ERP упадёт
        // (FAILED).
        await transactionRepo.insertMany([
            withRequestContext(() =>
                BalanceTransaction.createManual({
                    employeeId: 1,
                    direction: 'shop',
                    type: 'BONUS',
                    amount: 5000,
                    createdBy: 7,
                }),
            ),
            withRequestContext(() =>
                BalanceTransaction.createManual({
                    employeeId: 3,
                    direction: 'shop',
                    type: 'BONUS',
                    amount: 2000,
                    createdBy: 7,
                }),
            ),
        ]);

        const response = await withRequestContext(() =>
            batchHandler.execute(
                new CreateShopPayoutBatchCommand({
                    employeeIds: [1, 2, 3],
                    createdBy: 7,
                }),
            ),
        );

        expect(response.direction).toBe('shop');
        expect(response.paidCount).toBe(1);
        expect(response.totalPaidAmount).toBe(5000);
        const byEmployee = new Map(
            response.outcomes.map((outcome) => [outcome.employeeId, outcome]),
        );
        expect(byEmployee.get(1)).toMatchObject({
            status: 'PAID',
            amount: 5000,
        });
        expect(byEmployee.get(2)).toMatchObject({
            status: 'NEEDS_CONFIRMATION',
            amount: null,
            balance: 0,
        });
        expect(byEmployee.get(3)).toMatchObject({
            status: 'FAILED',
            amount: null,
            balance: 2000,
        });
        expect(byEmployee.get(3)?.message).toContain('МойСклад недоступен');

        // Упавший сотрудник 3 не оставил движения на балансе (ERP-ошибка —
        // ничего не записано, тот же контракт, что у одиночной выплаты).
        await expect(transactionRepo.sumByEmployee(3)).resolves.toBe(2000);
        await expect(transactionRepo.sumByEmployee(1)).resolves.toBe(0);
    });
});
