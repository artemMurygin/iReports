import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import {
    DepartmentSummary,
    DirectoryRepositoryPort,
    EmployeeSummary,
    FindEmployeesOptions,
} from '../../application/ports/directory.port';

// Read-only справочник поверх уже синхронизированных BitrixDepartment/
// BitrixEmployee (prisma/schema/bitrix.prisma) — без записи, поэтому не
// наследует PrismaRepository (нет write()/событий агрегата, см.
// GetCatalogService в domains/shop/modules/warehouse — тот же приём для
// read-only доступа к БД).
@Injectable()
export class DirectoryRepository implements DirectoryRepositoryPort {
    constructor(private readonly db: DatabaseService) {}

    async findDepartments(): Promise<DepartmentSummary[]> {
        const departments = await this.db.bitrixDepartment.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        return departments;
    }

    async findEmployees(
        departmentId?: number,
        options?: FindEmployeesOptions,
    ): Promise<EmployeeSummary[]> {
        const employees = await this.db.bitrixEmployee.findMany({
            // По умолчанию (includeServiceAccounts не передан/false) —
            // isServiceAccount: false, отсев служебных аккаунтов из всех
            // зарплатных списков/справочников (Фаза 3, см. WHY на
            // FindEmployeesOptions в directory.port.ts); departmentId,
            // отсутствуя, не сужает выборку (тот же приём, что и раньше).
            where: {
                ...(departmentId === undefined ? {} : { departmentId }),
                ...(options?.includeServiceAccounts
                    ? {}
                    : { isServiceAccount: false }),
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                departmentId: true,
                // Должность — только для сквозного списка взаиморасчётов
                // (см. WHY в EmployeeSummary.position); остальные
                // потребители читают тот же select и просто игнорируют поле.
                position: true,
                isServiceAccount: true,
            },
            orderBy: { order: 'asc' },
        });
        return employees;
    }

    // Узкая выборка id служебных аккаунтов (Фаза 3) — см. WHY на порте.
    async findServiceAccountEmployeeIds(): Promise<Set<number>> {
        const employees = await this.db.bitrixEmployee.findMany({
            where: { isServiceAccount: true },
            select: { id: true },
        });
        return new Set(employees.map((employee) => employee.id));
    }

    // Включение/выключение признака «служебный аккаунт» (Фаза 3) —
    // существование сотрудника проверяется отдельным запросом ДО update
    // (тот же приём "найти, потом действовать", что и в остальных
    // handler'ах проекта — см. например DeleteWorkScheduleEntryHandler),
    // а не catch на P2025 от Prisma: так граница "сотрудник не найден"
    // видна на уровне репозитория явным null, а не проброшенным исключением
    // ORM.
    async setServiceAccount(
        employeeId: number,
        isServiceAccount: boolean,
    ): Promise<EmployeeSummary | null> {
        const exists = await this.db.bitrixEmployee.findUnique({
            where: { id: employeeId },
            select: { id: true },
        });
        if (!exists) {
            return null;
        }
        const employee = await this.db.bitrixEmployee.update({
            where: { id: employeeId },
            data: { isServiceAccount },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                departmentId: true,
                position: true,
                isServiceAccount: true,
            },
        });
        return employee;
    }

    // Батч-обновление локального, независимого от Bitrix24-синхронизации
    // порядка сотрудников (docs/employee-ordering-and-salary-filter, Фаза 1)
    // — доступно любому авторизованному пользователю без отдельных прав
    // (см. ReorderEmployeesHandler). $transaction — атомарность: либо все
    // строки получают новый order, либо ни одна (частичное применение при
    // ошибке на середине списка увеличило бы риск дублирующихся order,
    // из-за которых порядок стал бы неоднозначным между двумя сотрудниками).
    async updateEmployeesOrder(
        items: { employeeId: number; order: number }[],
    ): Promise<void> {
        if (items.length === 0) {
            return;
        }
        await this.db.$transaction(
            items.map((item) =>
                this.db.bitrixEmployee.update({
                    where: { id: item.employeeId },
                    data: { order: item.order },
                }),
            ),
        );
    }
}
