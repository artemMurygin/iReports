import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { EmployeeBalanceOwnershipGuard } from './employee-balance-ownership.guard';

// spec: employee-balance#view-own-balance-without-view-all.
describe('EmployeeBalanceOwnershipGuard', () => {
    const buildContext = (
        user: { employeeId: number; permissions: string[] } | undefined,
        params: { id?: string } = {},
    ): ExecutionContext =>
        ({
            switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
        }) as unknown as ExecutionContext;

    it('пропускает пользователя с employee-balance:view_all к чужому балансу', () => {
        const guard = new EmployeeBalanceOwnershipGuard();

        expect(
            guard.canActivate(
                buildContext(
                    {
                        employeeId: 1,
                        permissions: ['employee-balance:view_all'],
                    },
                    { id: '999' },
                ),
            ),
        ).toBe(true);
    });

    it('пропускает пользователя с employee-balance:view_own к СВОЕМУ балансу', () => {
        const guard = new EmployeeBalanceOwnershipGuard();

        expect(
            guard.canActivate(
                buildContext(
                    {
                        employeeId: 42,
                        permissions: ['employee-balance:view_own'],
                    },
                    { id: '42' },
                ),
            ),
        ).toBe(true);
    });

    it('отклоняет пользователя с employee-balance:view_own к ЧУЖОМУ балансу (403)', () => {
        const guard = new EmployeeBalanceOwnershipGuard();

        expect(() =>
            guard.canActivate(
                buildContext(
                    {
                        employeeId: 42,
                        permissions: ['employee-balance:view_own'],
                    },
                    { id: '43' },
                ),
            ),
        ).toThrow(ForbiddenException);
    });

    it('отклоняет пользователя вовсе без нужных permissions (403)', () => {
        const guard = new EmployeeBalanceOwnershipGuard();

        expect(() =>
            guard.canActivate(
                buildContext({ employeeId: 42, permissions: [] }, { id: '42' }),
            ),
        ).toThrow(ForbiddenException);
    });
});
