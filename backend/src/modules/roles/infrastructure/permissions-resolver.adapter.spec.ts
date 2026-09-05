import { PermissionsResolverAdapter } from './permissions-resolver.adapter';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// spec: roles#model-role-permission — агрегирует permissionCode всех ролей
// сотрудника без дублей (один и тот же код может встречаться в нескольких
// ролях, назначенных одному сотруднику).
describe('PermissionsResolverAdapter', () => {
    const createAdapter = (
        employeeRoles: Array<{
            role: { rolePermissions: Array<{ permission: { code: string } }> };
        }>,
    ) => {
        const findMany = jest.fn().mockResolvedValue(employeeRoles);
        const db = { employeeRole: { findMany } } as unknown as DatabaseService;
        const adapter = new PermissionsResolverAdapter(db);
        return { adapter, findMany };
    };

    it('возвращает объединённый список кодов без дублей из нескольких ролей', async () => {
        const { adapter } = createAdapter([
            {
                role: {
                    rolePermissions: [
                        { permission: { code: 'reports:view' } },
                        { permission: { code: 'reports:edit' } },
                    ],
                },
            },
            {
                role: {
                    rolePermissions: [
                        { permission: { code: 'reports:view' } },
                        { permission: { code: 'roles:manage' } },
                    ],
                },
            },
        ]);

        const permissions = await adapter.resolvePermissions(42);

        expect([...permissions].sort()).toEqual([
            'reports:edit',
            'reports:view',
            'roles:manage',
        ]);
    });

    it('возвращает пустой список для сотрудника без единой роли', async () => {
        const { adapter } = createAdapter([]);

        await expect(adapter.resolvePermissions(999)).resolves.toEqual([]);
    });
});
