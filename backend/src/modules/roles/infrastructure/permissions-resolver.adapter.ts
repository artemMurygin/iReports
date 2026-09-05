import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import type { PermissionsResolverPort } from '../application/ports/permissions-resolver.port';

// Реализация PERMISSIONS_RESOLVER_PORT (design.md, Decision 1) — вызывается
// `auth` (AuthenticatedSessionIssuer) прямо перед созданием сессии.
// Обращается к Prisma напрямую (роли/права — справочник этого же модуля,
// не отдельный агрегат, требующий своего репозитория с доменным поведением).
@Injectable()
export class PermissionsResolverAdapter implements PermissionsResolverPort {
    constructor(private readonly db: DatabaseService) {}

    async resolvePermissions(bitrixEmployeeId: number): Promise<string[]> {
        const employeeRoles = await this.db.employeeRole.findMany({
            where: { bitrixEmployeeId },
            include: {
                role: {
                    include: {
                        rolePermissions: { include: { permission: true } },
                    },
                },
            },
        });

        const codes = new Set<string>();
        for (const employeeRole of employeeRoles) {
            for (const rolePermission of employeeRole.role.rolePermissions) {
                codes.add(rolePermission.permission.code);
            }
        }

        return [...codes];
    }
}
