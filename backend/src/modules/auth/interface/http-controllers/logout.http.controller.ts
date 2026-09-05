import {
    Controller,
    HttpCode,
    HttpStatus,
    Inject,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { LogoutResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import {
    clearSessionCookie,
    extractSessionId,
} from '@/modules/session/interface/session-request.util';
import {
    SESSION_PORT,
    type SessionPort,
} from '@/modules/session/application/ports/session.port';

// spec: session#logout-deletes-session-server-side — удаляет запись сессии
// из Redis, а не только cookie/состояние на клиенте (spec:
// session#session-reuse-after-logout-rejected — повторное предъявление того
// же session_id после logout получает 401). CsrfGuard — logout мутирует
// состояние (удаляет сессию), поэтому cookie-вариант доставки требует
// double-submit CSRF так же, как и остальные мутирующие запросы (раздел 13
// tasks.md); для Authorization-заголовка (iframe) CsrfGuard — no-op.
@ApiTags('Роли и доступ: аутентификация Bitrix24')
@UseGuards(SessionAuthGuard, CsrfGuard)
@Controller()
export class LogoutHttpController {
    constructor(
        @Inject(SESSION_PORT) private readonly sessionPort: SessionPort,
    ) {}

    @Post(routesV1.auth.logout)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:
            'Выход из системы: удаляет сессию из Redis (не только cookie/состояние на клиенте)',
    })
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<LogoutResponse> {
        // SessionAuthGuard уже подтвердил валидность сессии — sessionId
        // гарантированно присутствует в запросе тем же способом извлечения,
        // что и в самом guard'е.
        const sessionId = extractSessionId(req) as string;
        await this.sessionPort.invalidateSession(sessionId);
        clearSessionCookie(res);

        return { success: true };
    }
}
