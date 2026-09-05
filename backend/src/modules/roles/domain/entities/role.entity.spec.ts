import { withRequestContext } from '@/shared/testing/with-request-context';
import { Role } from './role.entity';

// spec: roles#model-role-permission — Role хранит именованный набор
// permissions; каждый код набора обязан быть валидным resource:action
// (PermissionCode самовалидируется).
describe('Role', () => {
    it('создаёт роль без permissions по умолчанию', () => {
        const role = withRequestContext(() => Role.create({ name: 'Оператор' }));

        expect(role.name).toBe('Оператор');
        expect(role.isSystem).toBe(false);
        expect(role.permissionCodes).toEqual([]);
        expect(role.id).toEqual(expect.any(String));
    });

    it('создаёт роль сразу с набором permissions без дублей', () => {
        const role = withRequestContext(() =>
            Role.create({
                name: 'Администратор',
                isSystem: true,
                permissionCodes: ['roles:manage', 'roles:view', 'roles:manage'],
            }),
        );

        expect(role.isSystem).toBe(true);
        expect([...role.permissionCodes].sort()).toEqual([
            'roles:manage',
            'roles:view',
        ]);
    });

    it('отклоняет создание роли с пустым названием', () => {
        expect(() =>
            withRequestContext(() => Role.create({ name: '   ' })),
        ).toThrow();
    });

    it('отклоняет создание роли с невалидным форматом permission-кода', () => {
        expect(() =>
            withRequestContext(() =>
                Role.create({ name: 'Оператор', permissionCodes: ['RolesManage'] }),
            ),
        ).toThrow();
    });

    it('rename() меняет название роли', () => {
        const role = withRequestContext(() => Role.create({ name: 'Оператор' }));

        withRequestContext(() => role.rename('Старший оператор'));

        expect(role.name).toBe('Старший оператор');
    });

    it('rename() отклоняет пустое название', () => {
        const role = withRequestContext(() => Role.create({ name: 'Оператор' }));

        expect(() => withRequestContext(() => role.rename(''))).toThrow();
    });

    it('updatePermissions() полностью заменяет набор permissions роли без дублей', () => {
        const role = withRequestContext(() =>
            Role.create({ name: 'Оператор', permissionCodes: ['reports:view'] }),
        );

        withRequestContext(() =>
            role.updatePermissions(['reports:edit', 'reports:edit', 'reports:view']),
        );

        expect([...role.permissionCodes].sort()).toEqual([
            'reports:edit',
            'reports:view',
        ]);
    });

    it('updatePermissions() отклоняет невалидный формат кода', () => {
        const role = withRequestContext(() => Role.create({ name: 'Оператор' }));

        expect(() =>
            withRequestContext(() => role.updatePermissions(['reports edit'])),
        ).toThrow();
    });
});
