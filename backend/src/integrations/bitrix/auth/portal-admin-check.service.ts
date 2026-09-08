import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from '@/infrustructure/database/database.service';

// Признак «администратор портала» кэшируется на короткое время — иначе
// каждый запрос к эндпоинтам EmployeeIdentity бил бы в Bitrix REST (см.
// docs/payroll/prd-payroll-calculation.md, раздел 1 и "Технические
// ограничения"). 60 секунд — компромисс между нагрузкой на Bitrix24 и тем,
// как быстро отзыв прав администратора долетит до iReports.
const ADMIN_CACHE_TTL_MS = 60_000;

interface CacheEntry {
    isAdmin: boolean;
    expiresAt: number;
}

/**
 * Проверяет, является ли пользователь, чей access token передан фронтендом
 * (BX24.getAuth().access_token — приложение встроено в Bitrix24), админом
 * портала. Признак берётся из Bitrix REST `user.admin`, вызванного с
 * токеном самого пользователя, а не из вебхука/OAuth-токена установки
 * приложения (тот отвечает за приложение, а не за конкретного человека).
 *
 * Fail-closed: любая ошибка — сеть, таймаут, отсутствие установки,
 * неожиданный ответ — трактуется как "не администратор", а не пропускается.
 */
@Injectable()
export class BitrixPortalAdminCheckService {
    private readonly logger = new Logger(BitrixPortalAdminCheckService.name);
    private readonly cache = new Map<string, CacheEntry>();

    constructor(private readonly db: DatabaseService) {}

    // `clientEndpoint`, когда он уже известен вызывающему коду (оба сценария
    // входа — OAuth и embedded — резолвят его сами, см. WHY в
    // BitrixEmbeddedLoginHandler), позволяет обойтись без похода в БД за
    // `BitrixInstallation`: та запись создаётся только install-вебхуком
    // (`POST /bitrix/install`), который не вызывается для упрощённо
    // зарегистрированного тестового приложения Bitrix24 — без этого
    // параметра bootstrap первого администратора (authenticated-session-
    // issuer.service.ts) на таком стенде не срабатывал бы никогда
    // (обнаружено как реальный баг на dev-стенде: "установка Bitrix24 не
    // найдена — доступ закрыт" в логе при каждом логине, роль
    // Administrator не назначалась). PortalAdminGuard, у которого в руках
    // только голый токен из заголовка, продолжает пользоваться БД-фолбэком.
    async isPortalAdmin(
        accessToken: string,
        clientEndpoint?: string,
    ): Promise<boolean> {
        const cached = this.cache.get(accessToken);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.isAdmin;
        }

        const isAdmin = await this.checkViaBitrix(accessToken, clientEndpoint);
        this.cache.set(accessToken, {
            isAdmin,
            expiresAt: Date.now() + ADMIN_CACHE_TTL_MS,
        });
        return isAdmin;
    }

    private async checkViaBitrix(
        accessToken: string,
        clientEndpoint?: string,
    ): Promise<boolean> {
        try {
            const endpoint =
                clientEndpoint ??
                (await this.resolveEndpointFromInstallation());
            if (!endpoint) {
                return false;
            }

            const { data } = await axios.get<{ result?: unknown }>(
                `${endpoint}user.admin`,
                { params: { auth: accessToken }, timeout: 5_000 },
            );

            return data?.result === true;
        } catch (err) {
            this.logger.warn(
                `Bitrix24 недоступен при проверке администратора портала — доступ закрыт (fail-closed): ${
                    err instanceof Error ? err.message : String(err)
                }`,
            );
            return false;
        }
    }

    private async resolveEndpointFromInstallation(): Promise<string | null> {
        const installation = await this.db.bitrixInstallation.findFirst({
            orderBy: { installedAt: 'desc' },
        });

        if (!installation) {
            this.logger.warn(
                'Проверка администратора портала невозможна: установка Bitrix24 не найдена — доступ закрыт (fail-closed)',
            );
            return null;
        }

        return installation.clientEndpoint;
    }
}
