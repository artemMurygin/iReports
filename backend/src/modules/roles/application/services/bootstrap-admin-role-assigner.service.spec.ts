import { withRequestContext } from '@/shared/testing/with-request-context';
import { BootstrapAdminRoleAssigner } from './bootstrap-admin-role-assigner.service';
import { Role } from '../../domain/entities/role.entity';
import type { RoleRepositoryPort } from '../ports/role.repository.port';

// spec: roles (design.md, Decision 9 — bootstrap первого администратора) —
// назначение системной роли Administrator сотруднику без единой роли.
describe('BootstrapAdminRoleAssigner', () => {
    const createAssigner = (options?: { roles?: Role[] }) => {
        const roles = new Map((options?.roles ?? []).map((r) => [r.id, r]));
        const assignedByEmployee = new Map<number, Set<string>>();

        const roleRepository: jest.Mocked<RoleRepositoryPort> = {
            insert: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByName: jest.fn(async (name: string) => {
                for (const role of roles.values()) {
                    if (role.name === name) return role;
                }
                return null;
            }),
            findAll: jest.fn(),
            assignToEmployee: jest.fn(
                async (bitrixEmployeeId: number, roleId: string) => {
                    const set =
                        assignedByEmployee.get(bitrixEmployeeId) ??
                        new Set<string>();
                    set.add(roleId);
                    assignedByEmployee.set(bitrixEmployeeId, set);
                },
            ),
            revokeFromEmployee: jest.fn(),
            findEmployeeIdsByRoleId: jest.fn(),
            hasAnyRole: jest.fn(
                async (bitrixEmployeeId: number) =>
                    (assignedByEmployee.get(bitrixEmployeeId)?.size ?? 0) > 0,
            ),
        };

        const assigner = new BootstrapAdminRoleAssigner(roleRepository);

        return { assigner, roleRepository, assignedByEmployee };
    };

    describe('hasAnyRole', () => {
        it('делегирует проверку репозиторию ролей', async () => {
            const { assigner, roleRepository } = createAssigner();
            roleRepository.hasAnyRole.mockResolvedValueOnce(true);

            await expect(assigner.hasAnyRole(42)).resolves.toBe(true);
            expect(roleRepository.hasAnyRole).toHaveBeenCalledWith(42);
        });
    });

    describe('assignAdministratorRole', () => {
        it('назначает сотруднику существующую системную роль Administrator', async () => {
            const admin = withRequestContext(() =>
                Role.create({
                    name: 'Administrator',
                    isSystem: true,
                    permissionCodes: ['roles:manage'],
                }),
            );
            const { assigner, roleRepository } = createAssigner({
                roles: [admin],
            });

            await assigner.assignAdministratorRole(42);

            expect(roleRepository.assignToEmployee).toHaveBeenCalledWith(
                42,
                admin.id,
            );
        });

        it('ничего не делает, если роль Administrator ещё не засеяна', async () => {
            const { assigner, roleRepository } = createAssigner();

            await assigner.assignAdministratorRole(42);

            expect(roleRepository.assignToEmployee).not.toHaveBeenCalled();
        });
    });
});
