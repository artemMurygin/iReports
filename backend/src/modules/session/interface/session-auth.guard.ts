import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionService } from '../infrastructure/session.service';
import { IS_PUBLIC_KEY } from '@/shared/decorators/public.decorator';

export interface AuthenticatedRequestUser {
    employeeId: number;
    permissions: string[];
}

// spec: roles#session-required-for-protected-routes /
// session#reject-requests-without-valid-session /
// roles#public-routes-no-authentication. Guard'ы бросают нативные
// исключения @nestjs/common, не доменные (design.md, Decision 4) — это
// инфраструктурная проверка доступа на границе HTTP, а не бизнес-правило
// конкретного модуля.
@Injectable()
export class SessionAuthGuard implements CanActivate {
    constructor(
        private readonly sessionService: SessionService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const sessionId = this.extractSessionId(request);

        if (!sessionId) {
            throw new UnauthorizedException('Требуется вход в систему');
        }

        let result: Awaited<
            ReturnType<SessionService['validateSessionAndTouch']>
        >;
        try {
            result = await this.sessionService.validateSessionAndTouch(
                sessionId,
            );
        } catch {
            // Fail-closed (design.md, Decision 10): недоступность Redis —
            // не пропуск запроса, а отсутствие валидной сессии.
            throw new UnauthorizedException(
                'Сервис сессий временно недоступен',
            );
        }

        if (!result) {
            throw new UnauthorizedException('Сессия не найдена или истекла');
        }

        (request as Request & { user: AuthenticatedRequestUser }).user = {
            employeeId: result.bitrixEmployeeId,
            permissions: result.permissions,
        };

        return true;
    }

    // Authorization: Bearer <session_id> — контекст iframe портала Bitrix24
    // (spec: session#header-delivery-for-iframe); cookie `session_id` —
    // standalone-сайт/iOS (spec: session#cookie-delivery-for-standalone-and-ios).
    private extractSessionId(request: Request): string | null {
        const authHeader = request.header('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.slice('Bearer '.length).trim();
        }

        const cookieSessionId = (request as Request & {
            cookies?: Record<string, string>;
        }).cookies?.session_id;

        return cookieSessionId ?? null;
    }
}
