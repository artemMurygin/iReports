import type { Server } from 'http';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { SessionService } from '@/modules/session/infrastructure/session.service';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { Public } from '@/shared/decorators/public.decorator';

// add-bitrix24-auth-and-rbac, раздел 24 tasks.md (24.1-24.2) — единственный
// тест в репозитории, проверяющий САМУ регистрацию SessionAuthGuard/
// PermissionsGuard как APP_GUARD (backend/src/app.module.ts), а не
// поведение guard'ов как таковое: то уже исчерпывающе покрыто
// session-auth.guard.spec.ts/permissions.guard.spec.ts/roles.e2e.spec.ts —
// там guard'ы применяются точечно через `@UseGuards` на конкретных
// контроллерах, не через `APP_GUARD`.
//
// ВАЖНО: ни один существующий `*.e2e.spec.ts` какого-либо другого модуля
// (`directory.e2e.spec.ts`, `catalog.e2e.spec.ts`, `sales-plan.e2e.spec.ts`
// и т.д.) не бутстрапит настоящий `AppModule` целиком — каждый собирает
// свой локальный `@Module` только со своими контроллерами (ради изоляции от
// транзитивных зависимостей `AppModule` — `BitrixModule`/Prisma/Redis/т.д.,
// требующих реальных внешних сервисов). Значит регистрация `APP_GUARD` в
// `app.module.ts` невидима для всего остального test suite: `npm run test`
// остаётся зелёным независимо от того, зарегистрированы ли guard'ы вообще
// и правильно ли — этот файл закрывает именно этот пробел, собирая
// МИНИМАЛЬНЫЙ модуль с двумя тестовыми контроллерами (защищённым и
// `@Public()`) и РОВНО той же формой регистрации `{ provide: APP_GUARD,
// useClass: ... }`, что и в `app.module.ts`.
@Controller('internal-test-route')
class UnprotectedTestController {
    @Get()
    ping() {
        return { ok: true };
    }
}

@Controller('internal-test-public-route')
class PublicTestController {
    @Public()
    @Get()
    ping() {
        return { ok: true };
    }
}

describe('Глобальная регистрация SessionAuthGuard/PermissionsGuard как APP_GUARD (e2e)', () => {
    let app: INestApplication<Server>;

    const validateSessionAndTouch = jest.fn();
    const fakeSessionService: Partial<SessionService> = {
        validateSessionAndTouch,
    };

    @Module({
        controllers: [UnprotectedTestController, PublicTestController],
        providers: [
            { provide: SessionService, useValue: fakeSessionService },
            Reflector,
            { provide: APP_GUARD, useClass: SessionAuthGuard },
            { provide: APP_GUARD, useClass: PermissionsGuard },
        ],
    })
    class GlobalGuardTestModule {}

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [GlobalGuardTestModule],
        }).compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // spec: roles#session-required-for-protected-routes — раньше (без
    // APP_GUARD) этот роут был бы открыт всем без исключения, ровно то
    // поведение, которое design.md Decision 5/Migration Plan шаг 6-7
    // называли "системой, открытой по умолчанию" до включения APP_GUARD.
    it('роут без @Public() и без сессии теперь получает 401', async () => {
        await request(app.getHttpServer())
            .get('/internal-test-route')
            .expect(401);
    });

    // spec: roles#route-without-permissions-open-to-any-authenticated —
    // роут без @RequirePermissions доступен любому аутентифицированному
    // сотруднику, глобальный PermissionsGuard не требует конкретных прав.
    it('роут без @Public(), но с валидной сессией и без @RequirePermissions — доступен (200)', async () => {
        validateSessionAndTouch.mockResolvedValueOnce({
            bitrixEmployeeId: 1,
            permissions: [],
        });

        await request(app.getHttpServer())
            .get('/internal-test-route')
            .set('Authorization', 'Bearer session-abc')
            .expect(200);
    });

    // spec: roles#public-routes-no-authentication — @Public() освобождает
    // роут от обеих проверок глобального guard-стека.
    it('роут с @Public() остаётся доступен без сессии', async () => {
        await request(app.getHttpServer())
            .get('/internal-test-public-route')
            .expect(200);

        expect(validateSessionAndTouch).not.toHaveBeenCalled();
    });
});
