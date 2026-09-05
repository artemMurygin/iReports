import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { PermissionCode } from './permission-code.value-object';

// spec: roles#model-role-permission — Permission.code SHALL быть в формате
// `resource:action` (proposal.md, "Ввести RBAC-модель данных").
describe('PermissionCode', () => {
    it('принимает валидный формат resource:action', () => {
        const code = PermissionCode.create('reports:view');

        expect(code.unpack()).toBe('reports:view');
    });

    it('принимает составные resource/action с дефисами', () => {
        const code = PermissionCode.create('sales-plan:soft-delete');

        expect(code.unpack()).toBe('sales-plan:soft-delete');
    });

    it('два VO с одинаковым значением равны', () => {
        expect(
            PermissionCode.create('roles:manage').equals(
                PermissionCode.create('roles:manage'),
            ),
        ).toBe(true);
    });

    it.each([
        'reports',
        'reports:',
        ':view',
        'reports:view:extra',
        'Reports:View',
        'reports view',
        '',
    ])('отклоняет невалидный формат "%s"', (value) => {
        withRequestContext(() => {
            expect(() => PermissionCode.create(value)).toThrow(
                ArgumentInvalidException,
            );
        });
    });
});
