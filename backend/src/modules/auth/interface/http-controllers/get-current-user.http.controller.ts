import {
    Controller,
    Get,
    Inject,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthMeResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import type { AuthenticatedRequestUser } from '@/modules/session/interface/session-auth.guard';
import {
    BITRIX_EMPLOYEE_LOOKUP_PORT,
    type BitrixEmployeeLookupPort,
} from '../../application/ports/bitrix-employee-lookup.port';

// spec: roles#get-current-user — идентификатор пользователя и полный список
// текущих permissions, для инициализации клиентского состояния
// (useCurrentUser). Единственная проверка — валидная сессия
// (SessionAuthGuard); без @RequirePermissions — доступен любому
// аутентифицированному пользователю (spec:
// roles#route-without-permissions-open-to-any-authenticated). Guard применён
// точечно на этом контроллере — без него request.user не наполняется вовсе
// и эндпоинт не может функционировать, независимо от того, что глобальная
// регистрация APP_GUARD для остальных роутов приложения отложена (см. WHY в
// app.module.ts).
@ApiTags('Роли и доступ: аутентификация Bitrix24')
@UseGuards(SessionAuthGuard)
@Controller()
export class GetCurrentUserHttpController {
    constructor(
        @Inject(BITRIX_EMPLOYEE_LOOKUP_PORT)
        private readonly employeeLookup: BitrixEmployeeLookupPort,
    ) {}

    @Get(routesV1.auth.me)
    @ApiOperation({
        summary:
            'Текущий аутентифицированный сотрудник и его permissions (инициализация клиентского состояния после входа)',
    })
    async me(@Req() req: Request): Promise<AuthMeResponse> {
        const user = (req as Request & { user: AuthenticatedRequestUser }).user;

        const employee = await this.employeeLookup.findById(user.employeeId);
        if (!employee) {
            // Крайний случай: сотрудник удалён из BitrixEmployee уже ПОСЛЕ
            // выдачи сессии (например, ручной откат синка) — сессия всё ещё
            // валидна в Redis, но опираться дальше не на что.
            throw new UnauthorizedException(
                'Сотрудник сессии не найден в справочнике',
            );
        }

        return {
            employee: {
                id: employee.id,
                firstName: employee.firstName ?? '',
                lastName: employee.lastName ?? '',
            },
            permissions: user.permissions,
        };
    }
}
