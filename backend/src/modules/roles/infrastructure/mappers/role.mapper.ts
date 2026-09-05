import {
    Role as RoleRecord,
    RolePermission,
    Permission,
    Prisma,
} from '../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { Role } from '../../domain/entities/role.entity';

type RoleRecordWithPermissions = RoleRecord & {
    rolePermissions: (RolePermission & { permission: Permission })[];
};

export class RoleMapper
    implements Mapper<Role, Prisma.RoleCreateInput>
{
    toDomain(record: RoleRecordWithPermissions): Role {
        return new Role({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                name: record.name,
                isSystem: record.isSystem,
                permissionCodes: record.rolePermissions.map(
                    (rolePermission) => rolePermission.permission.code,
                ),
            },
        });
    }

    // Не используется для update (см. RoleRepository.save — заменяет
    // rolePermissions целиком через nested deleteMany/create), только для
    // insert().
    toPersistence(entity: Role): Prisma.RoleCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            name: props.name,
            isSystem: props.isSystem,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
            rolePermissions: {
                create: props.permissionCodes.map((code) => ({
                    permission: { connect: { code } },
                })),
            },
        };
    }
}
