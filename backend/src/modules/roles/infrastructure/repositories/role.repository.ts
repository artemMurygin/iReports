import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { Role } from '../../domain/entities/role.entity';
import type { RoleRepositoryPort } from '../../application/ports/role.repository.port';
import { RoleMapper } from '../mappers/role.mapper';

@Injectable()
export class RoleRepository
    extends PrismaRepository
    implements RoleRepositoryPort
{
    private readonly mapper = new RoleMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(role: Role): Promise<void> {
        await this.write(role, (client) =>
            client.role.create({ data: this.mapper.toPersistence(role) }),
        );
    }

    // Полная замена: name + весь набор rolePermissions (Role.updatePermissions
    // — не патч по одному коду, см. role.entity.ts) — deleteMany без фильтра
    // на nested-относении удаляет только строки RolePermission, принадлежащие
    // ЭТОЙ роли (Prisma скоупит nested-операции родителем).
    async save(role: Role): Promise<void> {
        const props = role.getProps();
        await this.write(role, (client) =>
            client.role.update({
                where: { id: props.id },
                data: {
                    name: props.name,
                    updatedAt: props.updatedAt,
                    rolePermissions: {
                        deleteMany: {},
                        create: props.permissionCodes.map((code) => ({
                            permission: { connect: { code } },
                        })),
                    },
                },
            }),
        );
    }

    async delete(id: string): Promise<void> {
        // RolePermission/EmployeeRole — onDelete: Cascade (auth.prisma).
        await this.write(null, (client) =>
            client.role.delete({ where: { id } }),
        );
    }

    async findById(id: string): Promise<Role | null> {
        const record = await this.client.role.findUnique({
            where: { id },
            include: { rolePermissions: { include: { permission: true } } },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByName(name: string): Promise<Role | null> {
        const record = await this.client.role.findUnique({
            where: { name },
            include: { rolePermissions: { include: { permission: true } } },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findAll(): Promise<Role[]> {
        const records = await this.client.role.findMany({
            include: { rolePermissions: { include: { permission: true } } },
            orderBy: { name: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async assignToEmployee(
        bitrixEmployeeId: number,
        roleId: string,
    ): Promise<void> {
        await this.write(null, (client) =>
            client.employeeRole.upsert({
                where: {
                    bitrixEmployeeId_roleId: { bitrixEmployeeId, roleId },
                },
                create: { bitrixEmployeeId, roleId },
                update: {},
            }),
        );
    }

    // deleteMany, не delete-по-уникальному-ключу — снятие роли, которая уже
    // не назначена, идемпотентно (не бросает P2025), а не считается ошибкой.
    async revokeFromEmployee(
        bitrixEmployeeId: number,
        roleId: string,
    ): Promise<void> {
        await this.write(null, (client) =>
            client.employeeRole.deleteMany({
                where: { bitrixEmployeeId, roleId },
            }),
        );
    }

    async findEmployeeIdsByRoleId(roleId: string): Promise<number[]> {
        const rows = await this.client.employeeRole.findMany({
            where: { roleId },
            select: { bitrixEmployeeId: true },
        });
        return rows.map((row) => row.bitrixEmployeeId);
    }

    async hasAnyRole(bitrixEmployeeId: number): Promise<boolean> {
        const count = await this.client.employeeRole.count({
            where: { bitrixEmployeeId },
        });
        return count > 0;
    }

    // Группировка по bitrixEmployeeId делается в приложении, а не через
    // Prisma groupBy — groupBy не умеет вернуть агрегированный список
    // roleId по группе (только count/sum и т.п.), а строк EmployeeRole
    // (одна на пару сотрудник-роль) в масштабах компании не настолько
    // много, чтобы группировка в памяти была проблемой производительности.
    async findAllAssignments(): Promise<
        { bitrixEmployeeId: number; roleIds: string[] }[]
    > {
        const rows = await this.client.employeeRole.findMany({
            select: { bitrixEmployeeId: true, roleId: true },
            orderBy: { bitrixEmployeeId: 'asc' },
        });

        const byEmployee = new Map<number, string[]>();
        for (const row of rows) {
            const roleIds = byEmployee.get(row.bitrixEmployeeId);
            if (roleIds) {
                roleIds.push(row.roleId);
            } else {
                byEmployee.set(row.bitrixEmployeeId, [row.roleId]);
            }
        }

        return Array.from(byEmployee.entries()).map(
            ([bitrixEmployeeId, roleIds]) => ({ bitrixEmployeeId, roleIds }),
        );
    }
}
