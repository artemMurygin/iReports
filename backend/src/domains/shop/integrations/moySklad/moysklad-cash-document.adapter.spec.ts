import { BadGatewayException } from '@nestjs/common';
import { ErpCashConfig } from '@/domains/service/modules/accounting/domain/entities/erp-cash-config.entity';
import type { ErpCashConfigRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-config.port';
import { ErpCashDocument } from '@/domains/service/modules/accounting/domain/entities/erp-cash-document.entity';
import type { ErpCashDocumentRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import { EmployeeIdentity } from '@/modules/employee-identity/domain/entities/employee-identity.entity';
import type { EmployeeIdentityRepositoryPort } from '@/modules/employee-identity/application/ports/employee-identity.port';
import type { CreateErpCashDocumentParams } from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import {
    ShopEmployeeMoySkladIdentityMissingException,
    ShopErpCashConfigIncompleteException,
} from '@/domains/shop/modules/accounting/domain/exceptions/erp-cash-document.exception';
import { MoyskladCashDocumentAdapter } from './moysklad-cash-document.adapter';
import type { MoyskladHttpService } from './moysklad.instance';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Мок MoyskladHttpService.instance (axios), без реального HTTP — см.
// ограничение безопасности задачи (никаких мутирующих вызовов к реальному
// МойСкладу ни в рантайме, ни из тестов).
function createHttpMock() {
    return {
        post: jest.fn(),
        delete: jest.fn(),
    };
}

// Форма meta-ссылки, которую строит адаптер (см. metaRef в
// moysklad-cash-document.adapter.ts) — используем плоские проверки полей
// вместо expect.objectContaining, вложенного в объектный литерал: последнее
// типизировано как `any` и ловится no-unsafe-assignment.
interface MoyskladMetaRefLike {
    meta: { href: string; type: string; mediaType: string };
}

const SHOP_CONFIG = ErpCashConfig.create({
    direction: 'shop',
    organizationId: 'org-1',
    moySkladExpenseItemId: 'expense-1',
});

const MOY_SKLAD_IDENTITY = EmployeeIdentity.create({
    bitrixEmployeeId: 42,
    system: 'MOY_SKLAD',
    identifierType: 'EMPLOYEE_ID',
    externalId: 'employee-77',
});

const BASE_PARAMS: CreateErpCashDocumentParams = {
    transactionId: 'tx-1',
    amount: 1500,
    kind: 'OUTCOME',
    employeeId: 42,
    purpose: 'Зарплата за 2026-07, Иванов И.И.',
    occurredAt: new Date(Date.UTC(2026, 6, 31, 10, 15, 30)),
};

describe('MoyskladCashDocumentAdapter', () => {
    let http: ReturnType<typeof createHttpMock>;
    let configRepo: jest.Mocked<
        Pick<ErpCashConfigRepositoryPort, 'findByDirection'>
    >;
    let documentRepo: jest.Mocked<
        Pick<ErpCashDocumentRepositoryPort, 'findByTransactionId'>
    >;
    let employeeIdentityRepo: jest.Mocked<
        Pick<EmployeeIdentityRepositoryPort, 'findByEmployee'>
    >;
    let adapter: MoyskladCashDocumentAdapter;

    beforeEach(() => {
        http = createHttpMock();
        configRepo = { findByDirection: jest.fn() };
        documentRepo = { findByTransactionId: jest.fn() };
        employeeIdentityRepo = { findByEmployee: jest.fn() };

        adapter = new MoyskladCashDocumentAdapter(
            { instance: http } as unknown as MoyskladHttpService,
            configRepo as unknown as ErpCashConfigRepositoryPort,
            documentRepo as unknown as ErpCashDocumentRepositoryPort,
            employeeIdentityRepo as unknown as EmployeeIdentityRepositoryPort,
        );
    });

    describe('create', () => {
        it('собирает тело POST /entity/cashout для OUTCOME (сумма в копейках, статья расхода, agent = employee)', async () => {
            configRepo.findByDirection.mockResolvedValue(SHOP_CONFIG);
            employeeIdentityRepo.findByEmployee.mockResolvedValue([
                MOY_SKLAD_IDENTITY,
            ]);
            http.post.mockResolvedValue({ data: { id: 'cashout-1' } });

            const result = await adapter.create(BASE_PARAMS);

            expect(result).toEqual({ externalId: 'cashout-1' });
            expect(http.post).toHaveBeenCalledTimes(1);
            const [endpoint, body, config] = http.post.mock.calls[0] as [
                string,
                Record<string, unknown>,
                { timeout: number },
            ];
            expect(endpoint).toBe('/entity/cashout');
            expect(config.timeout).toBe(15_000);
            expect(body).toMatchObject({
                sum: 150_000, // 1500 рублей -> копейки
                description: BASE_PARAMS.purpose,
                moment: '2026-07-31 10:15:30',
                externalCode: 'tx-1',
            });
            const organization = body.organization as MoyskladMetaRefLike;
            expect(organization.meta.type).toBe('organization');
            expect(organization.meta.href).toContain(
                '/entity/organization/org-1',
            );

            const agent = body.agent as MoyskladMetaRefLike;
            expect(agent.meta.type).toBe('employee');
            expect(agent.meta.href).toContain('/entity/employee/employee-77');

            const expenseItem = body.expenseItem as MoyskladMetaRefLike;
            expect(expenseItem.meta.type).toBe('expenseitem');
            expect(expenseItem.meta.href).toContain(
                '/entity/expenseitem/expense-1',
            );
        });

        it('собирает тело POST /entity/cashin для INCOME без expenseItem/moySkladIncomeItemId', async () => {
            configRepo.findByDirection.mockResolvedValue(SHOP_CONFIG);
            employeeIdentityRepo.findByEmployee.mockResolvedValue([
                MOY_SKLAD_IDENTITY,
            ]);
            http.post.mockResolvedValue({ data: { id: 'cashin-1' } });

            const result = await adapter.create({
                ...BASE_PARAMS,
                kind: 'INCOME',
            });

            expect(result).toEqual({ externalId: 'cashin-1' });
            const [endpoint, body] = http.post.mock.calls[0] as [
                string,
                Record<string, unknown>,
            ];
            expect(endpoint).toBe('/entity/cashin');
            expect(body).not.toHaveProperty('expenseItem');
            expect(body).not.toHaveProperty('incomeItem');
            expect(body).not.toHaveProperty('moySkladIncomeItemId');
        });

        it('бросает ShopErpCashConfigIncompleteException до HTTP-вызова, если конфигурация кассы не заполнена', async () => {
            await withRequestContext(async () => {
                configRepo.findByDirection.mockResolvedValue(null);

                await expect(
                    adapter.create(BASE_PARAMS),
                ).rejects.toBeInstanceOf(ShopErpCashConfigIncompleteException);
                expect(http.post).not.toHaveBeenCalled();
            });
        });

        it('бросает ShopErpCashConfigIncompleteException, если для OUTCOME не задана статья расхода', async () => {
            await withRequestContext(async () => {
                configRepo.findByDirection.mockResolvedValue(
                    ErpCashConfig.create({
                        direction: 'shop',
                        organizationId: 'org-1',
                        moySkladExpenseItemId: null,
                    }),
                );

                await expect(
                    adapter.create(BASE_PARAMS),
                ).rejects.toBeInstanceOf(ShopErpCashConfigIncompleteException);
                expect(http.post).not.toHaveBeenCalled();
            });
        });

        it('не требует статьи расхода для INCOME', async () => {
            configRepo.findByDirection.mockResolvedValue(
                ErpCashConfig.create({
                    direction: 'shop',
                    organizationId: 'org-1',
                    moySkladExpenseItemId: null,
                }),
            );
            employeeIdentityRepo.findByEmployee.mockResolvedValue([
                MOY_SKLAD_IDENTITY,
            ]);
            http.post.mockResolvedValue({ data: { id: 'cashin-2' } });

            await expect(
                adapter.create({ ...BASE_PARAMS, kind: 'INCOME' }),
            ).resolves.toEqual({ externalId: 'cashin-2' });
        });

        it('бросает ShopEmployeeMoySkladIdentityMissingException, если у сотрудника нет связи MOY_SKLAD/EMPLOYEE_ID', async () => {
            await withRequestContext(async () => {
                configRepo.findByDirection.mockResolvedValue(SHOP_CONFIG);
                employeeIdentityRepo.findByEmployee.mockResolvedValue([]);

                await expect(
                    adapter.create(BASE_PARAMS),
                ).rejects.toBeInstanceOf(
                    ShopEmployeeMoySkladIdentityMissingException,
                );
                expect(http.post).not.toHaveBeenCalled();
            });
        });

        it('игнорирует связи сотрудника в других системах/типах при резолве agent', async () => {
            await withRequestContext(async () => {
                configRepo.findByDirection.mockResolvedValue(SHOP_CONFIG);
                employeeIdentityRepo.findByEmployee.mockResolvedValue([
                    EmployeeIdentity.create({
                        bitrixEmployeeId: 42,
                        system: 'ROAPP',
                        identifierType: 'EMPLOYEE_ID',
                        externalId: 'roapp-employee-1',
                    }),
                ]);

                await expect(
                    adapter.create(BASE_PARAMS),
                ).rejects.toBeInstanceOf(
                    ShopEmployeeMoySkladIdentityMissingException,
                );
            });
        });

        it('оборачивает ошибку HTTP в BadGatewayException', async () => {
            configRepo.findByDirection.mockResolvedValue(SHOP_CONFIG);
            employeeIdentityRepo.findByEmployee.mockResolvedValue([
                MOY_SKLAD_IDENTITY,
            ]);
            http.post.mockRejectedValue(new Error('network down'));
            // dumpError пишет файл на диск — не мокаем fs, но директория
            // integrations/moySklad уже существует и доступна для записи в
            // тестовом окружении, как и у MoyskladService.dumpError.

            await expect(adapter.create(BASE_PARAMS)).rejects.toBeInstanceOf(
                BadGatewayException,
            );
        });
    });

    describe('delete', () => {
        it('DELETE /entity/cashout/{id} для OUTCOME', async () => {
            http.delete.mockResolvedValue({});

            await adapter.delete({
                externalId: 'cashout-1',
                kind: 'OUTCOME',
                amount: 1500,
            });

            expect(http.delete).toHaveBeenCalledWith(
                '/entity/cashout/cashout-1',
                { timeout: 15_000 },
            );
        });

        it('DELETE /entity/cashin/{id} для INCOME', async () => {
            http.delete.mockResolvedValue({});

            await adapter.delete({
                externalId: 'cashin-1',
                kind: 'INCOME',
                amount: 1500,
            });

            expect(http.delete).toHaveBeenCalledWith(
                '/entity/cashin/cashin-1',
                { timeout: 15_000 },
            );
        });

        it('оборачивает ошибку HTTP в BadGatewayException', async () => {
            http.delete.mockRejectedValue(new Error('not found'));

            await expect(
                adapter.delete({
                    externalId: 'cashout-1',
                    kind: 'OUTCOME',
                    amount: 1500,
                }),
            ).rejects.toBeInstanceOf(BadGatewayException);
        });
    });

    describe('findByKey', () => {
        it('делегирует в ErpCashDocumentRepositoryPort.findByTransactionId', async () => {
            documentRepo.findByTransactionId.mockResolvedValue(
                ErpCashDocument.create({
                    transactionId: 'tx-1',
                    system: 'MOY_SKLAD',
                    kind: 'OUTCOME',
                    amount: 1500,
                    externalId: 'cashout-1',
                }),
            );

            const result = await adapter.findByKey('tx-1');

            expect(documentRepo.findByTransactionId).toHaveBeenCalledWith(
                'tx-1',
            );
            expect(result).toEqual({
                externalId: 'cashout-1',
                kind: 'OUTCOME',
                amount: 1500,
            });
        });

        it('возвращает null, если документ ещё не создавался', async () => {
            documentRepo.findByTransactionId.mockResolvedValue(null);

            await expect(adapter.findByKey('tx-none')).resolves.toBeNull();
        });
    });
});
