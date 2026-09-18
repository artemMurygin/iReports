import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionService } from '../infrastructure/session.service';
import { ApiKeyRepository } from '../infrastructure/api-key.repository';
import { ApiKey } from '../domain/value-objects/api-key.value-object';
import {
    PERMISSIONS_RESOLVER_PORT,
    type PermissionsResolverPort,
} from '@/modules/roles/application/ports/permissions-resolver.port';
import { IS_PUBLIC_KEY } from '@/shared/decorators/public.decorator';
import { extractSessionId } from './session-request.util';
import { isDevAuthBypassEnabled } from '@/shared/config/dev-auth-bypass';

const DEFAULT_DEV_EMPLOYEE_ID = 24018;
const API_KEY_HEADER = 'x-api-key';

export interface AuthenticatedRequestUser {
    employeeId: number;
    permissions: string[];
}

// add-employee-api-key-auth, tasks.md 6.3 / spec: auth/api-key#Регенерация
// недоступна без сессии. SessionAuthGuard заполняет `request.user`
// ОДИНАКОВО для сессии и для X-Api-Key (тот же employeeId/permissions), а
// регенерация ключа должна оставаться доступна только через Bitrix-сессию
// (design.md Decision 3) — иначе украденный ключ мог бы сам себя
// перевыпускать. Отдельный флаг на request (не поле AuthenticatedRequestUser
// — тот тип разделяют tasks/roles/auth-контроллеры, которым источник
// аутентификации не важен) позволяет RegenerateApiKeyHttpController
// отличить один способ аутентификации от другого без изменения формы
// `request.user`.
export const AUTHENTICATED_VIA_API_KEY_FLAG = 'authenticatedViaApiKey';

export interface RequestAuthenticatedViaApiKey {
    [AUTHENTICATED_VIA_API_KEY_FLAG]?: boolean;
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
        private readonly apiKeyRepository: ApiKeyRepository,
        // add-employee-api-key-auth, design.md Decision 3: PERMISSIONS_
        // RESOLVER_PORT — токен RolesModule, а SessionAuthGuard используется
        // через `@UseGuards()` НАПРЯМУЮ во многих модулях (auth, roles,
        // work-schedule и т.д.), каждый из которых импортирует только
        // SessionModule. Nest резолвит зависимости guard'а, подключённого
        // так, в области видимости МОДУЛЯ-ПОТРЕБИТЕЛЯ (а не модуля,
        // который его ЭКСПОРТИРУЕТ) — обычный constructor-DI для этого
        // токена заставил бы КАЖДЫЙ такой модуль дополнительно
        // импортировать RolesModule (и породил бы circular module
        // dependency между session/roles, т.к. RolesModule уже импортирует
        // SessionModule). ModuleRef.get(..., { strict: false }) ищет по
        // ВСЕМУ контейнеру приложения, не только по локально видимому
        // графу модуля-потребителя — тот же приём, что Nest документирует
        // для "lazy providers"/избежания циклов (см. WHY в
        // session.module.ts).
        private readonly moduleRef: ModuleRef,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();

        if (isDevAuthBypassEnabled()) {
            (request as Request & { user: AuthenticatedRequestUser }).user = {
                employeeId:
                    Number(process.env.DEV_EMPLOYEE_ID) ||
                    DEFAULT_DEV_EMPLOYEE_ID,
                permissions: [],
            };
            return true;
        }

        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (isPublic) {
            return true;
        }

        // add-employee-api-key-auth, design.md Decision 3: заголовок
        // X-Api-Key — самостоятельная ветка аутентификации, проверяемая ДО
        // сессионной логики (extractSessionId ниже). Наличие заголовка
        // однозначно определяет исход этого guard'а: либо ключ валиден и
        // запрос аутентифицируется им, либо отклоняется 401 — в
        // сессионную ветку запрос с этим заголовком не попадает, даже если
        // у него параллельно есть валидная cookie/Authorization-сессия
        // (spec: auth/api-key#Аутентификация запроса по API-ключу).
        const apiKeyHeader = request.header(API_KEY_HEADER);
        if (apiKeyHeader) {
            return this.authenticateByApiKey(request, apiKeyHeader);
        }

        const sessionId = extractSessionId(request);

        if (!sessionId) {
            throw new UnauthorizedException('Требуется вход в систему');
        }

        let result: Awaited<
            ReturnType<SessionService['validateSessionAndTouch']>
        >;
        try {
            result =
                await this.sessionService.validateSessionAndTouch(sessionId);
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

    // spec: auth/api-key#Аутентификация запроса по API-ключу,
    // auth/api-key#Ключ уволенного сотрудника перестаёт действовать.
    // Хэшируем сырое значение заголовка и ищем совпадение через
    // ApiKeyRepository (уже фильтрует isActive: true — уволенный
    // сотрудник не находится, даже если хэш совпадает); при находке
    // permissions резолвятся заново на каждый запрос через
    // PermissionsResolverPort, не кэшируясь нигде (design.md, Goals) —
    // тот же порт, что использует обычный логин при создании сессии.
    private async authenticateByApiKey(
        request: Request,
        rawApiKey: string,
    ): Promise<boolean> {
        const hash = ApiKey.hash(rawApiKey);
        const employee =
            await this.apiKeyRepository.findActiveEmployeeByApiKeyHash(hash);

        if (!employee) {
            throw new UnauthorizedException('Недействительный API-ключ');
        }

        const permissionsResolver = this.moduleRef.get<PermissionsResolverPort>(
            PERMISSIONS_RESOLVER_PORT,
            { strict: false },
        );
        const permissions = await permissionsResolver.resolvePermissions(
            employee.employeeId,
        );

        (request as Request & { user: AuthenticatedRequestUser }).user = {
            employeeId: employee.employeeId,
            permissions,
        };
        (request as Request & RequestAuthenticatedViaApiKey)[
            AUTHENTICATED_VIA_API_KEY_FLAG
        ] = true;

        return true;
    }
}
