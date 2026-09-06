import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { BitrixOAuthCallbackResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { Public } from '@/shared/decorators/public.decorator';
import {
    applyCsrfCookie,
    applySessionCookie,
} from '@/modules/session/interface/session-request.util';
import { BitrixOAuthLoginHandler } from '../../application/services/bitrix-oauth-login.handler';
import { BitrixOAuthCallbackDto } from '../dto/bitrix-oauth-callback.dto';

// spec: auth#oauth-authorization-code-flow / auth#oauth-code-exchange-without-delay
// / auth#client-secret-isolation / auth#ios-oauth. @Public() — обмен code на
// токены — сам момент установления сессии, валидной сессии ещё не
// существует. Один и тот же эндпоинт для standalone-сайта и iOS (design.md
// — redirect_uri в виде universal link/кастомной URL-схемы обрабатывается
// тем же способом обмена кода на backend).
@ApiTags('Роли и доступ: аутентификация Bitrix24')
@Controller()
export class BitrixOAuthCallbackHttpController {
    constructor(private readonly handler: BitrixOAuthLoginHandler) {}

    @Public()
    @Post(routesV1.auth.oauthCallback)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:
            'OAuth 2.0 callback: обмен code на access_token/refresh_token строго на backend (oauth.bitrix24.tech/oauth/token/), выдача сессии cookie',
    })
    async callback(
        @Body() body: BitrixOAuthCallbackDto,
        @Res({ passthrough: true }) res: Response,
    ): Promise<BitrixOAuthCallbackResponse> {
        const { sessionId } = await this.handler.execute(
            body.code,
            body.state,
            body.redirectUri,
        );

        // Доставка через HttpOnly/Secure/SameSite=None cookie (spec:
        // session#cookie-delivery-for-standalone-and-ios) — sessionId
        // намеренно НЕ попадает в тело ответа (spec:
        // auth#client-secret-isolation распространяется на весь ответ этого
        // эндпоинта: ничего секретного клиенту, кроме самой HttpOnly cookie).
        applySessionCookie(res, sessionId);
        // CSRF double-submit cookie (design.md, Decision 7; раздел 13
        // tasks.md) — читаемая JS-cookie с производным от sessionId
        // значением, возвращается фронтендом в заголовке при мутирующих
        // запросах.
        applyCsrfCookie(res, sessionId);

        return { success: true };
    }
}
