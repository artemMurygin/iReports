import { SessionService } from './session.service';
import { SESSION_TTL_SECONDS } from '../session.config';

// Мини-фейк ioredis, реализующий только команды, которыми пользуется
// SessionService — тот же приём, что и фейковые репозитории в
// employee-identity.e2e.spec.ts (без реальной сетевой зависимости).
class FakeRedis {
    private hashes = new Map<string, Record<string, string>>();
    private sets = new Map<string, Set<string>>();
    ttlCalls: Array<{ key: string; seconds: number }> = [];

    async hset(key: string, data: Record<string, string>): Promise<void> {
        const existing = this.hashes.get(key) ?? {};
        this.hashes.set(key, { ...existing, ...data });
    }

    async hgetall(key: string): Promise<Record<string, string>> {
        return this.hashes.get(key) ?? {};
    }

    async expire(key: string, seconds: number): Promise<void> {
        this.ttlCalls.push({ key, seconds });
    }

    async sadd(key: string, member: string): Promise<void> {
        const set = this.sets.get(key) ?? new Set<string>();
        set.add(member);
        this.sets.set(key, set);
    }

    async srem(key: string, member: string): Promise<void> {
        this.sets.get(key)?.delete(member);
    }

    async smembers(key: string): Promise<string[]> {
        return [...(this.sets.get(key) ?? [])];
    }

    async del(...keys: string[]): Promise<void> {
        keys.forEach((key) => {
            this.hashes.delete(key);
            this.sets.delete(key);
        });
    }

    // Помощник для тестов — не часть контракта ioredis.
    hasHash(key: string): boolean {
        return this.hashes.has(key);
    }
}

// spec: session#session-created-on-login / session#sliding-expiration-ttl /
// session#logout-deletes-session-server-side /
// session#force-invalidate-all-sessions /
// roles#immediate-permission-changes (refreshPermissionsForEmployee).
describe('SessionService', () => {
    const createService = () => {
        const redis = new FakeRedis();
        const service = new SessionService(redis as any);
        return { service, redis };
    };

    describe('createSession', () => {
        it('генерирует новый session_id при каждом вызове (защита от session fixation)', async () => {
            const { service } = createService();

            const first = await service.createSession(
                42,
                ['reports:view'],
                'cookie',
            );
            const second = await service.createSession(
                42,
                ['reports:view'],
                'cookie',
            );

            expect(first.sessionId).not.toBe(second.sessionId);
        });

        it('сохраняет bitrixEmployeeId/permissions и продлевает TTL', async () => {
            const { service, redis } = createService();

            const { sessionId } = await service.createSession(
                42,
                ['reports:view', 'reports:edit'],
                'header',
            );

            expect(redis.hasHash(`session:${sessionId}`)).toBe(true);
            expect(redis.ttlCalls).toContainEqual({
                key: `session:${sessionId}`,
                seconds: SESSION_TTL_SECONDS,
            });
        });

        it('добавляет session_id в обратный индекс employee_sessions:<id>', async () => {
            const { service, redis } = createService();

            const { sessionId } = await service.createSession(42, [], 'cookie');

            expect(await redis.smembers('employee_sessions:42')).toContain(
                sessionId,
            );
        });
    });

    describe('validateSessionAndTouch', () => {
        it('возвращает employeeId/permissions для валидной сессии и продлевает TTL', async () => {
            const { service, redis } = createService();
            const { sessionId } = await service.createSession(
                42,
                ['reports:view'],
                'cookie',
            );
            redis.ttlCalls = [];

            const result = await service.validateSessionAndTouch(sessionId);

            expect(result).toEqual({
                bitrixEmployeeId: 42,
                permissions: ['reports:view'],
            });
            expect(redis.ttlCalls).toContainEqual({
                key: `session:${sessionId}`,
                seconds: SESSION_TTL_SECONDS,
            });
        });

        it('возвращает null для несуществующей сессии', async () => {
            const { service } = createService();

            await expect(
                service.validateSessionAndTouch('a'.repeat(43)),
            ).resolves.toBeNull();
        });

        it('возвращает null для невалидного формата session_id (не бросает исключение)', async () => {
            const { service } = createService();

            await expect(
                service.validateSessionAndTouch('short'),
            ).resolves.toBeNull();
        });
    });

    describe('invalidateSession', () => {
        it('удаляет сессию — последующая валидация возвращает null', async () => {
            const { service } = createService();
            const { sessionId } = await service.createSession(42, [], 'cookie');

            await service.invalidateSession(sessionId);

            await expect(
                service.validateSessionAndTouch(sessionId),
            ).resolves.toBeNull();
        });

        it('удаляет session_id из обратного индекса сотрудника', async () => {
            const { service, redis } = createService();
            const { sessionId } = await service.createSession(42, [], 'cookie');

            await service.invalidateSession(sessionId);

            expect(await redis.smembers('employee_sessions:42')).not.toContain(
                sessionId,
            );
        });
    });

    describe('invalidateAllSessionsForEmployee', () => {
        it('удаляет все сессии сотрудника одной операцией', async () => {
            const { service } = createService();
            const a = await service.createSession(42, [], 'cookie');
            const b = await service.createSession(42, [], 'header');
            const other = await service.createSession(7, [], 'cookie');

            await service.invalidateAllSessionsForEmployee(42);

            await expect(
                service.validateSessionAndTouch(a.sessionId),
            ).resolves.toBeNull();
            await expect(
                service.validateSessionAndTouch(b.sessionId),
            ).resolves.toBeNull();
            await expect(
                service.validateSessionAndTouch(other.sessionId),
            ).resolves.not.toBeNull();
        });
    });

    describe('refreshPermissionsForEmployee', () => {
        it('обновляет permissions во всех активных сессиях сотрудника без релогина', async () => {
            const { service } = createService();
            const { sessionId } = await service.createSession(
                42,
                ['reports:view', 'reports:edit'],
                'cookie',
            );

            await service.refreshPermissionsForEmployee(42, ['reports:view']);

            const result = await service.validateSessionAndTouch(sessionId);
            expect(result?.permissions).toEqual(['reports:view']);
        });
    });
});
