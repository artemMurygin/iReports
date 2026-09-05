import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/shared/decorators/public.decorator';
import { PERMISSIONS_KEY } from '@/shared/decorators/require-permissions.decorator';
import type { AuthenticatedRequestUser } from '@/modules/session/interface/session-auth.guard';

// spec: roles#permission-check-on-route /
// roles#route-without-permissions-open-to-any-authenticated. Guard'ы
// бросают нативные исключения @nestjs/common, не доменные (design.md,
// Decision 4). Выполняется ПОСЛЕ SessionAuthGuard в APP_GUARD (design.md,
// Decision 5) — request.user уже заполнен к моменту работы этого guard'а.
@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (isPublic) {
            return true;
        }

        const requiredPermissions = this.reflector.getAllAndOverride<
            string[] | undefined
        >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

        // Роут без @RequirePermissions доступен любому аутентифицированному
        // пользователю (spec: roles#route-without-permissions-open-to-any-authenticated).
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        const request = context
            .switchToHttp()
            .getRequest<{ user?: AuthenticatedRequestUser }>();
        const userPermissions = request.user?.permissions ?? [];

        const hasAllRequired = requiredPermissions.every((permission) =>
            userPermissions.includes(permission),
        );
        if (!hasAllRequired) {
            throw new ForbiddenException(
                'Недостаточно прав для выполнения операции',
            );
        }

        return true;
    }
}
