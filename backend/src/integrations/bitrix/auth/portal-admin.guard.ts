import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { BitrixPortalAdminCheckService } from './portal-admin-check.service';

// Фронтенд, встроенный в Bitrix24, кладёт сюда access token текущего
// пользователя (BX24.getAuth().access_token) — этим токеном, а не
// вебхуком/OAuth-токеном установки приложения, проверяется user.admin.
// Сам фронтенд для этого блока реализуется в Фазе 15 — до тех пор эндпоинты
// без заголовка всегда отдают 403 (fail-closed).
export const BITRIX_AUTH_HEADER = 'x-bitrix-auth';

/**
 * Гард «администратор портала Bitrix24» — единственный, кому в этой
 * итерации разрешён блок EmployeeIdentity (см.
 * docs/payroll/prd-payroll-calculation.md, раздел 1). Роль руководителя
 * (не администратора портала) сюда не допускается — модель прав в
 * iReports не заводится, источник истины остаётся за порталом.
 */
@Injectable()
export class PortalAdminGuard implements CanActivate {
    constructor(private readonly adminCheck: BitrixPortalAdminCheckService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = request.header(BITRIX_AUTH_HEADER);

        if (!token) {
            throw new ForbiddenException(
                'Доступ только для администратора портала Bitrix24: не передан токен текущего пользователя',
            );
        }

        const isAdmin = await this.adminCheck.isPortalAdmin(token);
        if (!isAdmin) {
            throw new ForbiddenException(
                'Доступ только для администратора портала Bitrix24',
            );
        }

        return true;
    }
}
