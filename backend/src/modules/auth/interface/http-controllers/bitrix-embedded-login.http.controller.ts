import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BitrixEmbeddedLoginResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { Public } from '@/shared/decorators/public.decorator';
import { BitrixEmbeddedLoginHandler } from '../../application/services/bitrix-embedded-login.handler';
import { BitrixEmbeddedLoginDto } from '../dto/bitrix-embedded-login.dto';

// spec: auth#embedded-login-success / auth#embedded-token-must-be-verified-via-rest.
// @Public() — вход не требует уже существующей сессии (spec:
// roles#public-routes-no-authentication); сама валидация AUTH_ID происходит
// внутри BitrixEmbeddedLoginHandler реальным REST-запросом к Bitrix24, а не
// на основании одних лишь переданных данных.
@ApiTags('Роли и доступ: аутентификация Bitrix24')
@Controller()
export class BitrixEmbeddedLoginHttpController {
    constructor(private readonly handler: BitrixEmbeddedLoginHandler) {}

    @Public()
    @Post(routesV1.auth.embeddedLogin)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:
            'Embedded-вход из iframe портала Bitrix24 (BX24.init() → AUTH_ID/member_id, валидируется реальным REST-запросом user.current)',
    })
    async login(
        @Body() body: BitrixEmbeddedLoginDto,
    ): Promise<BitrixEmbeddedLoginResponse> {
        const { sessionId } = await this.handler.execute(
            body.authId,
            body.memberId,
            body.domain,
        );
        // Доставка через заголовок (spec: session#header-delivery-for-iframe)
        // — sessionId возвращается в теле, cookie не устанавливается.
        return { sessionId };
    }
}
