import { EmployeeIdentityRepository } from './employee-identity.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// Явная проверка (docs/employee-ordering-and-salary-filter, Фаза 3, "Явно
// проверить, что эндпоинты ... связей сотрудников (EmployeeIdentity)
// продолжают возвращать служебных сотрудников без изменений"): справочник
// несопоставленных сотрудников (GET /v1/employee-identity/unmatched) не
// зависит от DirectoryRepositoryPort/isServiceAccount вообще — читает
// BitrixEmployee напрямую своим собственным запросом, без фильтра
// isServiceAccount в where. Тест фиксирует это на уровне контракта с Prisma
// (аргументы вызова), а не полагается на то, что метод просто не был
// тронут в этой фазе.
describe('EmployeeIdentityRepository — findUnmatchedEmployees (Фаза 3, служебные аккаунты)', () => {
    it('не фильтрует по isServiceAccount — where содержит только identities: { none: {} }', async () => {
        const findMany = jest.fn().mockResolvedValue([]);
        const db = {
            getClient: () => ({ bitrixEmployee: { findMany } }),
        } as unknown as DatabaseService;
        const repository = new EmployeeIdentityRepository(db);

        await repository.findUnmatchedEmployees();

        expect(findMany).toHaveBeenCalledWith({
            where: { identities: { none: {} } },
            orderBy: { id: 'asc' },
        });
    });

    it('возвращает несопоставленного служебного сотрудника без изменений', async () => {
        const serviceAccountEmployee = {
            id: 104,
            firstName: 'Служебный',
            lastName: 'Аккаунт',
            departmentId: 3,
            // isServiceAccount: true в реальной БД — метод его даже не
            // выбирает (select по умолчанию, без явного select), а
            // результат наружу не пробрасывает: фильтрации по нему тут
            // нет ни на входе (where), ни на выходе (map).
        };
        const findMany = jest.fn().mockResolvedValue([serviceAccountEmployee]);
        const db = {
            getClient: () => ({ bitrixEmployee: { findMany } }),
        } as unknown as DatabaseService;
        const repository = new EmployeeIdentityRepository(db);

        const result = await repository.findUnmatchedEmployees();

        expect(result).toEqual([
            {
                id: 104,
                firstName: 'Служебный',
                lastName: 'Аккаунт',
                departmentId: 3,
            },
        ]);
    });
});
