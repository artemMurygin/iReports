import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '@/shared/decorators/public.decorator';
import { CSRF_HEADER_NAME, SESSION_COOKIE_NAME } from '../session.config';
import { isValidCsrfToken } from './session-request.util';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// spec: session#csrf-protection-for-cookie-session (design.md, Decision 7) —
// double-submit CSRF применяется ТОЛЬКО к cookie-варианту доставки сессии
// (SameSite=None допускает cross-site отправку cookie); Authorization:
// Bearer (iframe, design.md) не отправляется браузером автоматически
// кросс-сайтово и в этой защите не нуждается. Guard'ы бросают нативные
// исключения @nestjs/common, не доменные (design.md, Decision 4) — тот же
// принцип, что и у SessionAuthGuard/PermissionsGuard.
@Injectable()
export class CsrfGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();

        // Только изменяющие состояние запросы нуждаются в CSRF-защите (spec:
        // "изменяющий состояние запрос (например, POST/PATCH/DELETE)").
        if (SAFE_METHODS.has(request.method.toUpperCase())) {
            return true;
        }

        // Authorization-заголовок — доставка для iframe-контекста, CSRF ей
        // не грозит (spec: session#header-delivery-for-iframe).
        const authHeader = request.header('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            return true;
        }

        // Request.cookies типизирован @types/cookie-parser как Record<string,
        // any> (не optional), но остаётся undefined без подключённого
        // middleware cookie-parser — `?.` защищает от TypeError (см. тот же
        // комментарий в session-request.util.ts).
        const cookieSessionId = request.cookies?.[SESSION_COOKIE_NAME] as
            string | undefined;
        // Нет cookie-сессии вовсе — не забота этого guard'а (SessionAuthGuard
        // уже отклонит запрос без валидной сессии своим 401).
        if (!cookieSessionId) {
            return true;
        }

        const csrfHeader = request.header(CSRF_HEADER_NAME);
        if (!csrfHeader || !isValidCsrfToken(csrfHeader, cookieSessionId)) {
            throw new ForbiddenException('Отсутствует или неверен CSRF-токен');
        }

        return true;
    }
}
