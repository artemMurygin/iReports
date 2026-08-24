import { ErpCashDocumentRepository } from './erp-cash-document.repository';
import { Prisma } from '../../../../../../../prisma/generated/prisma/schema/client';
import { ErpCashDocument } from '@/domains/service/modules/accounting/domain/entities/erp-cash-document.entity';
import { ErpCashDocumentAlreadyExistsException } from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// PRD 3 (docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 11), «Технические ограничения»: «либо есть оба, либо нет ни одного» +
// «адаптер проверяет наличие документа... чтобы не задвоить». Задвоение на
// уровне БД защищено уникальным индексом transactionId (erp-cash.prisma);
// этот файл проверяет ФАКТИЧЕСКОЕ поведение реализации (не in-memory фейка)
// на повторной вставке — тот же приём, что уже применён для
// BalanceTransactionRepository.insertMany (P2002 → понятное доменное
// исключение, а не сырой Prisma-эксепшн).
describe('ErpCashDocumentRepository', () => {
    const buildDocument = (transactionId = 'balance-tx-1') =>
        ErpCashDocument.create({
            transactionId,
            system: 'ROAPP',
            kind: 'INCOME',
            amount: 1500,
            externalId: '555',
        });

    const buildRepository = () => {
        const create = jest.fn();
        const findUnique = jest.fn();
        const client = { erpCashDocument: { create, findUnique } };
        const db = {
            getClient: () => client,
            // write() делегирует в db.withTransaction — здесь без реальной
            // Prisma-транзакции, просто выполняет колбэк (тот же приём, что
            // и остальные репозиторные юнит-тесты в этом файле дерева, см.
            // PrismaRepository.client → db.getClient()).
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        const repository = new ErpCashDocumentRepository(db);
        return { repository, create, findUnique };
    };

    describe('insert', () => {
        it('первая вставка — обычный create, без ошибок', async () => {
            const { repository, create } = buildRepository();
            create.mockResolvedValueOnce({});

            await withRequestContext(() => repository.insert(buildDocument()));

            expect(create).toHaveBeenCalledTimes(1);
            expect(create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    transactionId: 'balance-tx-1',
                }) as unknown,
            });
        });

        it('повторная вставка того же transactionId (P2002) не создаёт второй документ — понятное доменное исключение вместо сырого Prisma-эксепшна', async () => {
            const { repository, create } = buildRepository();
            const duplicateKeyError = new Prisma.PrismaClientKnownRequestError(
                'Unique constraint failed on the fields: (`transaction_id`)',
                { code: 'P2002', clientVersion: 'test' },
            );
            create.mockRejectedValueOnce(duplicateKeyError);

            const error = await withRequestContext(() =>
                repository.insert(buildDocument()).catch((e: unknown) => e),
            );

            expect(error).toBeInstanceOf(ErpCashDocumentAlreadyExistsException);
            expect((error as Error).message).toContain('balance-tx-1');
            // Ровно один вызов create — задвоения в самой ERP не произошло
            // бы (адаптер не повторяет create молча), ошибка проброшена
            // вызывающей стороне.
            expect(create).toHaveBeenCalledTimes(1);
        });

        it('другая ошибка Prisma (не P2002) пробрасывается как есть, не маскируется', async () => {
            const { repository, create } = buildRepository();
            const otherError = new Prisma.PrismaClientKnownRequestError(
                'Some other constraint failed',
                { code: 'P2003', clientVersion: 'test' },
            );
            create.mockRejectedValueOnce(otherError);

            const error = await withRequestContext(() =>
                repository.insert(buildDocument()).catch((e: unknown) => e),
            );

            expect(error).toBe(otherError);
        });
    });

    describe('findByTransactionId', () => {
        it('находит документ и мапит его в доменную сущность', async () => {
            const { repository, findUnique } = buildRepository();
            const now = new Date('2026-07-31T10:00:00.000Z');
            findUnique.mockResolvedValueOnce({
                id: 'doc-1',
                transactionId: 'balance-tx-1',
                system: 'ROAPP',
                kind: 'INCOME',
                amount: 1500,
                externalId: '555',
                createdAt: now,
            });

            const result = await repository.findByTransactionId('balance-tx-1');

            expect(findUnique).toHaveBeenCalledWith({
                where: { transactionId: 'balance-tx-1' },
            });
            expect(result?.externalId).toBe('555');
            expect(result?.transactionId).toBe('balance-tx-1');
        });

        it('нет записи — null', async () => {
            const { repository, findUnique } = buildRepository();
            findUnique.mockResolvedValueOnce(null);

            const result = await repository.findByTransactionId('unknown');

            expect(result).toBeNull();
        });
    });
});
