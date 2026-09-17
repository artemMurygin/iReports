import {
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { RegenerateApiKeyResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ApiKeyRepository } from '../../infrastructure/api-key.repository';
import { SessionAuthGuard } from '../session-auth.guard';
import {
    AUTHENTICATED_VIA_API_KEY_FLAG,
    type AuthenticatedRequestUser,
    type RequestAuthenticatedViaApiKey,
} from '../session-auth.guard';
import { CsrfGuard } from '../csrf.guard';

// add-employee-api-key-auth, design.md Decision 3, spec:
// auth/api-key#Регенерация ключа. Требует валидную Bitrix-сессию — маршрут
// НЕ @Public(), SessionAuthGuard уже наполняет request.user из сессии (или
// отклоняет запрос 401 раньше, чем этот обработчик вообще выполнится). Guard
// применён точечно на контроллере, тем же приёмом, что
// GetCurrentUserHttpController (см. WHY там про отложенную глобальную
// регистрацию APP_GUARD). CsrfGuard — эндпоинт мутирует состояние
// (инвалидирует прежний ключ), тот же паттерн, что LogoutHttpController/
// roles-контроллеры (backend/CLAUDE.md, ENDPOINTS.md: "мутирующие...
// дополнительно проходят CsrfGuard для cookie-сессий"); для iframe-доставки
// сессии (заголовок Authorization) CsrfGuard — no-op. SessionAuthGuard
// принимает и X-Api-Key, и сессию как равноценные способы аутентификации
// для большинства маршрутов, но spec: auth/api-key#Регенерация недоступна
// без сессии сужает ИМЕННО этот маршрут до сессии — см. проверку
// authenticatedViaApiKey в regenerate() ниже.
@ApiTags('Роли и доступ: аутентификация Bitrix24')
@UseGuards(SessionAuthGuard, CsrfGuard)
@Controller()
export class RegenerateApiKeyHttpController {
    constructor(private readonly apiKeyRepository: ApiKeyRepository) {}

    @Post(routesV1.auth.apiKeyRegenerate)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:
            'Регенерировать персональный API-ключ текущего сотрудника (инвалидирует прежний, новое значение видно только в этом ответе)',
    })
    async regenerate(@Req() req: Request): Promise<RegenerateApiKeyResponse> {
        // spec: auth/api-key#Регенерация недоступна без сессии. SessionAuthGuard
        // заполняет request.user одинаково для сессии и для X-Api-Key — без
        // этой проверки украденный/скомпрометированный ключ мог бы сам себя
        // перевыпускать через этот же эндпоинт, что противоречит идее
        // регенерации как способа инвалидировать именно скомпрометированный
        // ключ через независимый (сессионный) канал.
        const authenticatedViaApiKey = (
            req as Request & RequestAuthenticatedViaApiKey
        )[AUTHENTICATED_VIA_API_KEY_FLAG];
        if (authenticatedViaApiKey) {
            throw new UnauthorizedException(
                'Регенерация ключа доступна только через сессию',
            );
        }

        const user = (req as Request & { user: AuthenticatedRequestUser }).user;

        const apiKey = await this.apiKeyRepository.regenerateApiKey(
            user.employeeId,
        );

        return { apiKey };
    }
}
