import { BadGatewayException } from '@nestjs/common';
import { RoappCashDocumentAdapter } from './roapp-cash-document.adapter';
import { Cashbox } from '@/domains/service/modules/accounting/domain/entities/payout-cashbox-record.entity';
import {
    EmployeeErpIdentityMissingException,
    ErpCashConfigMissingException,
} from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type {
    ErpCashConfig,
    ErpCashConfigRepositoryPort,
} from '@/domains/service/modules/accounting/application/ports/erp-cash-config.port';
import type { PayoutCashboxRecordRepositoryPort } from '@/domains/service/modules/accounting/application/ports/payout-cashbox-record-repository.port';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import type { RoappHttpService } from './roapp.instace';

// НЕ реальные вызовы RemOnline — HTTP-клиент замокан целиком (post/delete —
// jest.fn()), см. ограничение задачи «никаких мутирующих вызовов к
// продовым RoApp/МойСклад».
describe('RoappCashDocumentAdapter', () => {
    const DEFAULT_CONFIG: ErpCashConfig = {
        direction: 'service',
        roappCashboxId: null,
        roappCategoryId: null,
        moySkladExpenseItemId: null,
        moySkladIncomeItemId: null,
        organizationId: null,
    };

    const okConfig: ErpCashConfig = {
        ...DEFAULT_CONFIG,
        roappCashboxId: 777,
        roappCategoryId: 42,
    };

    let post: jest.Mock;
    let del: jest.Mock;
    let findFirst: jest.Mock;
    let findByDirection: jest.Mock;
    let findByTransactionId: jest.Mock;
    let adapter: RoappCashDocumentAdapter;

    beforeEach(() => {
        post = jest.fn();
        del = jest.fn();
        findFirst = jest.fn().mockResolvedValue({ id: 'identity-1' });
        findByDirection = jest.fn().mockResolvedValue(okConfig);
        findByTransactionId = jest.fn();

        const roappHttp = {
            instance: { post, delete: del },
        } as unknown as RoappHttpService;
        const db = {
            getClient: () => ({ employeeIdentity: { findFirst } }),
        } as unknown as DatabaseService;
        const configRepo = {
            findByDirection,
            save: jest.fn(),
        } as unknown as ErpCashConfigRepositoryPort;
        const documentRepo = {
            findByTransactionId,
            insert: jest.fn(),
            deleteById: jest.fn(),
        } as unknown as PayoutCashboxRecordRepositoryPort;

        adapter = new RoappCashDocumentAdapter(
            roappHttp,
            db,
            configRepo,
            documentRepo,
        );
    });

    const baseParams = {
        transactionId: 'balance-tx-1',
        amount: 1500,
        kind: 'INCOME' as const,
        employeeId: 42,
        purpose: 'Зарплата за 2026-07 Иванов И.И.',
        occurredAt: new Date('2026-07-31T10:00:00.000Z'),
    };

    describe('create', () => {
        it('собирает тело запроса (amount как десятичная строка, direction, description) и возвращает externalId', async () => {
            post.mockResolvedValueOnce({ data: { id: 555 } });

            const result = await withRequestContext(() =>
                adapter.create(baseParams),
            );

            expect(result).toEqual({ externalId: '555' });
            expect(post).toHaveBeenCalledWith(
                '/finance/accounts/777/transactions',
                {
                    amount: '1500.00',
                    direction: 'income',
                    category_id: 42,
                    description: baseParams.purpose,
                    custom_created_at: '2026-07-31T10:00:00Z',
                },
                { timeout: 15_000 },
            );
        });

        it('OUTCOME -> direction: "expense"', async () => {
            post.mockResolvedValueOnce({ data: { id: 1 } });

            await withRequestContext(() =>
                adapter.create({ ...baseParams, kind: 'OUTCOME' }),
            );

            expect(post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ direction: 'expense' }),
                expect.anything(),
            );
        });

        it('строковый id в ответе ERP тоже принимается как externalId', async () => {
            post.mockResolvedValueOnce({ data: { id: 'txn-abc' } });

            const result = await withRequestContext(() =>
                adapter.create(baseParams),
            );

            expect(result).toEqual({ externalId: 'txn-abc' });
        });

        it('пустая конфигурация направления — отказ до HTTP-вызова', async () => {
            findByDirection.mockResolvedValueOnce(null);

            const error = await withRequestContext(() =>
                adapter.create(baseParams).catch((e: unknown) => e),
            );

            expect(error).toBeInstanceOf(ErpCashConfigMissingException);
            expect(post).not.toHaveBeenCalled();
        });

        it('конфигурация без roappCashboxId — отказ до HTTP-вызова', async () => {
            findByDirection.mockResolvedValueOnce(DEFAULT_CONFIG);

            const error = await withRequestContext(() =>
                adapter.create(baseParams).catch((e: unknown) => e),
            );

            expect(error).toBeInstanceOf(ErpCashConfigMissingException);
            expect(post).not.toHaveBeenCalled();
        });

        it('конфигурация без roappCategoryId — отказ до HTTP-вызова', async () => {
            findByDirection.mockResolvedValueOnce({
                ...DEFAULT_CONFIG,
                roappCashboxId: 777,
            });

            const error = await withRequestContext(() =>
                adapter.create(baseParams).catch((e: unknown) => e),
            );

            expect(error).toBeInstanceOf(ErpCashConfigMissingException);
            expect(post).not.toHaveBeenCalled();
        });

        it('сотрудник без EmployeeIdentity(ROAPP, EMPLOYEE_ID) — отказ до HTTP-вызова', async () => {
            findFirst.mockResolvedValueOnce(null);

            const error = await withRequestContext(() =>
                adapter.create(baseParams).catch((e: unknown) => e),
            );

            expect(error).toBeInstanceOf(EmployeeErpIdentityMissingException);
            expect(post).not.toHaveBeenCalled();
            expect(findFirst).toHaveBeenCalledWith({
                where: {
                    bitrixEmployeeId: 42,
                    system: 'ROAPP',
                    identifierType: 'EMPLOYEE_ID',
                },
            });
        });

        it('ошибка/таймаут RemOnline -> BadGatewayException, движение не создано локально', async () => {
            post.mockRejectedValueOnce(
                new Error('timeout of 15000ms exceeded'),
            );

            const error = await withRequestContext(() =>
                adapter.create(baseParams).catch((e: unknown) => e),
            );

            expect(error).toBeInstanceOf(BadGatewayException);
        });

        it('неожиданная форма ответа ERP (нет id) -> BadGatewayException', async () => {
            post.mockResolvedValueOnce({ data: {} });

            const error = await withRequestContext(() =>
                adapter.create(baseParams).catch((e: unknown) => e),
            );

            expect(error).toBeInstanceOf(BadGatewayException);
        });
    });

    describe('delete', () => {
        it('вызывает DELETE по account_id из конфигурации и externalId документа', async () => {
            del.mockResolvedValueOnce({ data: {} });

            await withRequestContext(() =>
                adapter.delete({
                    externalId: '555',
                    kind: 'INCOME',
                    amount: 1500,
                }),
            );

            expect(del).toHaveBeenCalledWith(
                '/finance/accounts/777/transactions/555',
                { timeout: 15_000 },
            );
        });

        it('пустая конфигурация — отказ до HTTP-вызова', async () => {
            findByDirection.mockResolvedValueOnce(null);

            const error = await withRequestContext(() =>
                adapter
                    .delete({ externalId: '555', kind: 'INCOME', amount: 1500 })
                    .catch((e: unknown) => e),
            );

            expect(error).toBeInstanceOf(ErpCashConfigMissingException);
            expect(del).not.toHaveBeenCalled();
        });

        it('ошибка/таймаут RemOnline -> BadGatewayException', async () => {
            del.mockRejectedValueOnce(new Error('Network Error'));

            const error = await withRequestContext(() =>
                adapter
                    .delete({ externalId: '555', kind: 'INCOME', amount: 1500 })
                    .catch((e: unknown) => e),
            );

            expect(error).toBeInstanceOf(BadGatewayException);
        });
    });

    describe('findByKey', () => {
        it('делегирует в PayoutCashboxRecordRepositoryPort.findByTransactionId и мапит форму', async () => {
            findByTransactionId.mockResolvedValueOnce(
                Cashbox.createPayout({
                    transactionId: 'balance-tx-1',
                    system: 'ROAPP',
                    kind: 'INCOME',
                    amount: 1500,
                    externalId: '555',
                }),
            );

            const result = await adapter.findByKey('balance-tx-1');

            expect(findByTransactionId).toHaveBeenCalledWith('balance-tx-1');
            expect(result).toEqual({
                externalId: '555',
                kind: 'INCOME',
                amount: 1500,
            });
        });

        it('нет локальной записи — null, RemOnline не запрашивается', async () => {
            findByTransactionId.mockResolvedValueOnce(null);

            const result = await adapter.findByKey('unknown-tx');

            expect(result).toBeNull();
            expect(post).not.toHaveBeenCalled();
            expect(del).not.toHaveBeenCalled();
        });
    });
});
