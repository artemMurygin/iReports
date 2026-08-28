import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { EmployeeDismissalPort } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';

// Read-only доступ к BitrixEmployee.isActive (bitrix.prisma) — без записи,
// поэтому не наследует PrismaRepository (тот же приём, что и
// DirectoryRepository в modules/directory).
@Injectable()
export class EmployeeDismissalRepository implements EmployeeDismissalPort {
    constructor(private readonly db: DatabaseService) {}

    async findDismissedEmployeeIds(
        employeeIds: number[],
    ): Promise<Set<number>> {
        if (employeeIds.length === 0) {
            return new Set();
        }
        const dismissed = await this.db.bitrixEmployee.findMany({
            where: { id: { in: employeeIds }, isActive: false },
            select: { id: true },
        });
        return new Set(dismissed.map((employee) => employee.id));
    }
}
