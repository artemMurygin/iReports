import { ApiKeyRepository } from './api-key.repository';
import { ApiKey } from '../domain/value-objects/api-key.value-object';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// add-employee-api-key-auth, tasks.md 3.1: реального test:e2e-контура с
// отдельной БД в проекте пока нет (см. WHY в
// stores.e2e.spec.ts/domains/shop/modules/warehouse) — как и остальные
// репозиторные тесты этого дерева (PayoutCashboxRecordRepository,
// AdministratorRoleSeeder), проверяем ФАКТИЧЕСКОЕ поведение реализации на
// стейтфул-фейке границы БД (не голых jest.fn() без состояния): findFirst/
// update здесь читают/пишут один и тот же in-memory "стол" строк
// bitrixEmployee, поэтому тест доказывает наблюдаемое поведение (уволенный
// не находится, регенерация инвалидирует старый хэш), а не только форму
// вызова Prisma.
interface FakeEmployeeRow {
    id: number;
    apiKeyHash: string | null;
    isActive: boolean;
}

describe('ApiKeyRepository', () => {
    const buildRepository = (rows: FakeEmployeeRow[]) => {
        const db = {
            bitrixEmployee: {
                findFirst: (args: {
                    where: { apiKeyHash: string; isActive: boolean };
                }) =>
                    Promise.resolve(
                        rows.find(
                            (row) =>
                                row.apiKeyHash === args.where.apiKeyHash &&
                                row.isActive === args.where.isActive,
                        ) ?? null,
                    ),
                update: (args: {
                    where: { id: number };
                    data: { apiKeyHash: string };
                }) => {
                    const row = rows.find((r) => r.id === args.where.id);
                    if (!row) {
                        throw new Error('row not found');
                    }
                    row.apiKeyHash = args.data.apiKeyHash;
                    return Promise.resolve(row);
                },
            },
        } as unknown as DatabaseService;

        return new ApiKeyRepository(db);
    };

    describe('findActiveEmployeeByApiKeyHash', () => {
        // spec: auth/api-key#Аутентификация запроса по API-ключу
        it('находит активного сотрудника по совпадающему хэшу', async () => {
            const rows: FakeEmployeeRow[] = [
                { id: 42, apiKeyHash: 'hash-active', isActive: true },
            ];
            const repository = buildRepository(rows);

            const result =
                await repository.findActiveEmployeeByApiKeyHash('hash-active');

            expect(result).toEqual({ employeeId: 42 });
        });

        // spec: auth/api-key#Ключ уволенного сотрудника перестаёт действовать
        it('не находит сотрудника с isActive: false, даже если хэш совпадает', async () => {
            const rows: FakeEmployeeRow[] = [
                { id: 7, apiKeyHash: 'hash-dismissed', isActive: false },
            ];
            const repository = buildRepository(rows);

            const result =
                await repository.findActiveEmployeeByApiKeyHash(
                    'hash-dismissed',
                );

            expect(result).toBeNull();
        });

        it('не находит никого при несовпадающем хэше', async () => {
            const rows: FakeEmployeeRow[] = [
                { id: 42, apiKeyHash: 'hash-active', isActive: true },
            ];
            const repository = buildRepository(rows);

            const result =
                await repository.findActiveEmployeeByApiKeyHash('unknown-hash');

            expect(result).toBeNull();
        });
    });

    describe('regenerateApiKey', () => {
        // spec: auth/api-key#Регенерация ключа — "backend сохраняет новое
        // значение ключа, возвращает его в ответе, и последующие запросы со
        // старым значением ключа больше не аутентифицируются".
        it('сохраняет новый хэш и инвалидирует старый — старый хэш больше не матчится', async () => {
            const oldHash = ApiKey.hash('irk_old-value');
            const rows: FakeEmployeeRow[] = [
                { id: 42, apiKeyHash: oldHash, isActive: true },
            ];
            const repository = buildRepository(rows);

            const rawNewValue = await repository.regenerateApiKey(42);

            expect(rawNewValue).toMatch(/^irk_[A-Za-z0-9_-]{43,}$/);
            expect(ApiKey.hash(rawNewValue)).toBe(rows[0].apiKeyHash);
            expect(rows[0].apiKeyHash).not.toBe(oldHash);

            // Старый хэш больше не матчится ни для какого активного
            // сотрудника.
            await expect(
                repository.findActiveEmployeeByApiKeyHash(oldHash),
            ).resolves.toBeNull();
            // Новый — матчится.
            await expect(
                repository.findActiveEmployeeByApiKeyHash(
                    ApiKey.hash(rawNewValue),
                ),
            ).resolves.toEqual({ employeeId: 42 });
        });

        it('возвращает разные значения ключа при повторных вызовах для одного сотрудника', async () => {
            const rows: FakeEmployeeRow[] = [
                { id: 42, apiKeyHash: null, isActive: true },
            ];
            const repository = buildRepository(rows);

            const first = await repository.regenerateApiKey(42);
            const second = await repository.regenerateApiKey(42);

            expect(first).not.toBe(second);
        });
    });
});
