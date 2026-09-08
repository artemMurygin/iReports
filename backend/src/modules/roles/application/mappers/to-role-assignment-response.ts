import type { RoleAssignment } from 'ireports-contracts';

// Раздел 22 tasks.md — маппинг доменного {bitrixEmployeeId, roleIds} в
// контрактный {employeeId, roleIds} (см. соглашение именования полей в
// contracts/commands/*.ts: bitrixEmployeeId остаётся именем внутри
// backend/Prisma, но наружу в HTTP-ответах отдаётся как employeeId — тот же
// приём, что и у directory/employee-balance/salary-*).
export function toRoleAssignmentResponse(assignment: {
    bitrixEmployeeId: number;
    roleIds: string[];
}): RoleAssignment {
    return {
        employeeId: assignment.bitrixEmployeeId,
        roleIds: assignment.roleIds,
    };
}
