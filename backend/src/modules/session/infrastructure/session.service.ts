import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/infrustructure/redis/redis-client.token';
import type {
    CreateSessionResult,
    SessionDelivery,
    SessionPort,
} from '../application/ports/session.port';
import { SessionId } from '../domain/value-objects/session-id.value-object';
import { SESSION_TTL_SECONDS } from '../session.config';

export interface ValidatedSession {
    bitrixEmployeeId: number;
    permissions: string[];
}

const sessionKey = (sessionId: string) => `session:${sessionId}`;
const employeeSessionsKey = (bitrixEmployeeId: number) =>
    `employee_sessions:${bitrixEmployeeId}`;

// Реализация SESSION_PORT поверх Redis (design.md, Decision 6):
// `session:<id>` — хэш {bitrixEmployeeId, permissions, issuedAt}, TTL =
// sliding expiration; `employee_sessions:<bitrixEmployeeId>` — SET
// session_id, без собственного TTL (обратный индекс для принудительной
// инвалидации, spec: session#force-invalidate-all-sessions).
@Injectable()
export class SessionService implements SessionPort {
    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

    async createSession(
        bitrixEmployeeId: number,
        permissions: string[],
        _delivery: SessionDelivery,
    ): Promise<CreateSessionResult> {
        // Новый session_id при КАЖДОМ вызове, включая повторный логин уже
        // вошедшего сотрудника (spec: session#session-id-entropy — защита
        // от session fixation).
        const sessionId = SessionId.generate().unpack();

        await this.redis.hset(sessionKey(sessionId), {
            bitrixEmployeeId: String(bitrixEmployeeId),
            permissions: JSON.stringify(permissions),
            issuedAt: new Date().toISOString(),
        });
        await this.redis.expire(sessionKey(sessionId), SESSION_TTL_SECONDS);
        await this.redis.sadd(
            employeeSessionsKey(bitrixEmployeeId),
            sessionId,
        );

        return { sessionId };
    }

    // Используется SessionAuthGuard (тот же модуль) напрямую — не часть
    // кросс-модульного SESSION_PORT (design.md, Decision 1 ограничивает
    // публичный контракт createSession/invalidate*/refreshPermissions*).
    async validateSessionAndTouch(
        rawSessionId: string,
    ): Promise<ValidatedSession | null> {
        let sessionId: string;
        try {
            sessionId = SessionId.create(rawSessionId).unpack();
        } catch {
            return null;
        }

        const data = await this.redis.hgetall(sessionKey(sessionId));
        if (!data || !data.bitrixEmployeeId) {
            return null;
        }

        // Sliding expiration (spec: session#sliding-expiration-ttl) —
        // продлевается от момента этого запроса.
        await this.redis.expire(sessionKey(sessionId), SESSION_TTL_SECONDS);

        return {
            bitrixEmployeeId: Number(data.bitrixEmployeeId),
            permissions: JSON.parse(data.permissions || '[]') as string[],
        };
    }

    async invalidateSession(sessionId: string): Promise<void> {
        const data = await this.redis.hgetall(sessionKey(sessionId));
        if (data?.bitrixEmployeeId) {
            await this.redis.srem(
                employeeSessionsKey(Number(data.bitrixEmployeeId)),
                sessionId,
            );
        }
        await this.redis.del(sessionKey(sessionId));
    }

    async invalidateAllSessionsForEmployee(
        bitrixEmployeeId: number,
    ): Promise<void> {
        const sessionIds = await this.redis.smembers(
            employeeSessionsKey(bitrixEmployeeId),
        );
        if (sessionIds.length > 0) {
            await this.redis.del(...sessionIds.map(sessionKey));
        }
        await this.redis.del(employeeSessionsKey(bitrixEmployeeId));
    }

    async refreshPermissionsForEmployee(
        bitrixEmployeeId: number,
        permissions: string[],
    ): Promise<void> {
        const sessionIds = await this.redis.smembers(
            employeeSessionsKey(bitrixEmployeeId),
        );
        await Promise.all(
            sessionIds.map((sessionId) =>
                this.redis.hset(sessionKey(sessionId), {
                    permissions: JSON.stringify(permissions),
                }),
            ),
        );
    }
}
