// DI-токен клиента Redis — по аналогии с UNIT_OF_WORK/DatabaseModule
// (см. backend/src/infrustructure/database/database.module.ts). Redis
// впервые появляется в проекте этой фичей (design.md, Decision 6): единый
// клиент на всё приложение, пространство ключей сессий (session:<id>,
// employee_sessions:<bitrixEmployeeId>) — за модулем session, будущие
// фичи кэширования переиспользуют этот же клиент, а не заводят второй.
//
// Вынесен в отдельный файл от redis.module.ts, чтобы RedisLifecycleService
// мог импортировать токен без циклической зависимости module <-> service.
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
