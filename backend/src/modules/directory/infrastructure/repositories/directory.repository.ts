import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import {
    DepartmentSummary,
    DirectoryRepositoryPort,
    EmployeeSummary,
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

    async findEmployees(departmentId?: number): Promise<EmployeeSummary[]> {
        const employees = await this.db.bitrixEmployee.findMany({
            where: departmentId === undefined ? undefined : { departmentId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                departmentId: true,
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        });
        return employees;
    }
}
