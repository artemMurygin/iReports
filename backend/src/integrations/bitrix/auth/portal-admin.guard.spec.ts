import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PortalAdminGuard } from './portal-admin.guard';
import { BitrixPortalAdminCheckService } from './portal-admin-check.service';

function makeContext(headerValue: string | undefined): ExecutionContext {
    const request = {
        header: (name: string) =>
            name === 'x-bitrix-auth' ? headerValue : undefined,
    };
    return {
        switchToHttp: () => ({
            getRequest: () => request,
        }),
    } as unknown as ExecutionContext;
}

describe('PortalAdminGuard', () => {
    let isPortalAdmin: jest.Mock;
    let guard: PortalAdminGuard;

    beforeEach(() => {
        isPortalAdmin = jest.fn();
        guard = new PortalAdminGuard({
            isPortalAdmin,
        } as unknown as BitrixPortalAdminCheckService);
    });

    it('отклоняет запрос без токена текущего пользователя, не обращаясь к Bitrix24', async () => {
        await expect(
            guard.canActivate(makeContext(undefined)),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(isPortalAdmin).not.toHaveBeenCalled();
    });

    it('пропускает администратора портала', async () => {
        isPortalAdmin.mockResolvedValueOnce(true);

        await expect(
            guard.canActivate(makeContext('admin-token')),
        ).resolves.toBe(true);
        expect(isPortalAdmin).toHaveBeenCalledWith('admin-token');
    });

    it('отклоняет пользователя, не являющегося администратором портала (например, руководителя)', async () => {
        isPortalAdmin.mockResolvedValueOnce(false);

        await expect(
            guard.canActivate(makeContext('manager-token')),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });
});
