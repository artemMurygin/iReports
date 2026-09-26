import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequestUser } from '@/modules/session/interface/session-auth.guard';
import { isDevAuthBypassEnabled } from '@/shared/config/dev-auth-bypass';

// WHY: `employee-balance:view_own` был заведён в каталоге permissions
// (employee-balance.permissions.ts), но ни один guard его не проверял —
// GetEmployeeBalanceHttpController требовал `employee-balance:view_all`
// безусловно (через PermissionsGuard/@RequirePermissions), поэтому
// сотрудник без этого права не мог открыть даже собственный баланс по
// прямой ссылке `/balance/employee/:id`. PermissionsGuard сам по себе
// AND-only (`.every()` по списку @RequirePermissions) — выразить "view_all
// ИЛИ (view_own И это мой id)" через него нельзя, поэтому вместо
// @RequirePermissions на контроллере используется отдельный guard: PermissionsGuard
// пропускает роут без @RequirePermissions любому аутентифицированному
// (см. PermissionsGuard), а этот guard делает финальную проверку владения.
@Injectable()
export class EmployeeBalanceOwnershipGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        if (isDevAuthBypassEnabled()) {
            return true;
        }

        const request = context
            .switchToHttp()
            .getRequest<Request & { user?: AuthenticatedRequestUser }>();
        const permissions = request.user?.permissions ?? [];

        if (permissions.includes('employee-balance:view_all')) {
            return true;
        }

        const targetEmployeeId = Number(request.params.id);
        if (
            permissions.includes('employee-balance:view_own') &&
            targetEmployeeId === request.user?.employeeId
        ) {
            return true;
        }

        throw new ForbiddenException(
            'Недостаточно прав для выполнения операции',
        );
    }
}
