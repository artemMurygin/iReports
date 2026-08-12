import { DealCatalogRepository } from './deal-catalog.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// Тот же приём мока DatabaseService, что и
// moysklad-sales-fact-source.repository.spec.ts —
// PrismaRepository.client делегирует в db.getClient(), поэтому фейковому db
// достаточно реализовать только этот метод.
//
// Главная цель файла — зафиксировать устранение N+1 из легаси
// DealsService.getDealsManagers() (src/TODO/deals/deals.service.ts): там на
// каждого distinct assignedById уходил отдельный
// bitrixEmployee.findFirst(...), здесь должен быть ровно один
// bitrixEmployee.findMany({ where: { id: { in: [...] } } }).
describe('DealCatalogRepository', () => {
    const buildRepository = (options: {
        assignedDeals: { assignedById: number | null }[];
        employees: { id: number; firstName: string; lastName: string }[];
    }) => {
        const dealFindMany = jest.fn().mockResolvedValue(options.assignedDeals);
        const employeeFindMany = jest.fn().mockResolvedValue(options.employees);
        const employeeFindFirst = jest.fn();

        const db = {
            getClient: () => ({
                bitrixDeal: { findMany: dealFindMany },
                bitrixEmployee: {
                    findMany: employeeFindMany,
                    findFirst: employeeFindFirst,
                },
            }),
        } as unknown as DatabaseService;

        const repository = new DealCatalogRepository(db);
        return {
            repository,
            dealFindMany,
            employeeFindMany,
            employeeFindFirst,
        };
    };

    it('находит менеджеров одним батч-запросом bitrixEmployee.findMany, а не findFirst на каждого', async () => {
        const { repository, employeeFindMany, employeeFindFirst } =
            buildRepository({
                assignedDeals: [
                    { assignedById: 1 },
                    { assignedById: 2 },
                    { assignedById: 3 },
                ],
                employees: [
                    { id: 1, firstName: 'Иван', lastName: 'Петров' },
                    { id: 2, firstName: 'Пётр', lastName: 'Иванов' },
                    { id: 3, firstName: 'Сидор', lastName: 'Сидоров' },
                ],
            });

        const managers = await repository.findManagers();

        expect(employeeFindMany).toHaveBeenCalledTimes(1);
        expect(employeeFindMany).toHaveBeenCalledWith({
            where: { id: { in: [1, 2, 3] } },
        });
        expect(employeeFindFirst).not.toHaveBeenCalled();

        expect(managers).toHaveLength(3);
        expect(managers.map((manager) => manager.getId())).toEqual([1, 2, 3]);
    });

    it('не запрашивает bitrixEmployee вовсе, когда за сделками не закреплён ни один менеджер', async () => {
        const { repository, employeeFindMany } = buildRepository({
            assignedDeals: [],
            employees: [],
        });

        const managers = await repository.findManagers();

        expect(managers).toEqual([]);
        expect(employeeFindMany).not.toHaveBeenCalled();
    });
});
