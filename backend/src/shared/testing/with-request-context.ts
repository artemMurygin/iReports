import { RequestContext } from 'nestjs-request-context';

/**
 * Многие базовые доменные классы (Command, DomainEvent, ExceptionBase —
 * см. src/shared/domain, src/shared/exceptions) в конструкторе читают
 * RequestContextService.getContext(). В проде эту AsyncLocalStorage-ветку
 * открывает RequestContextMiddleware на каждый HTTP-запрос (см.
 * app.module.ts). В юнит-тестах никакой middleware не запускается, поэтому
 * без обёртки RequestContext.currentContext окажется undefined и такой
 * конструктор упадёт с TypeError.
 *
 * Обёртку нужно вызывать непосредственно внутри it()/test(), а не в
 * beforeEach — jest-circus не переносит AsyncLocalStorage-контекст,
 * выставленный в хуке, в тело следующего за ним теста.
 */
export function withRequestContext<T>(fn: () => T): T {
    return RequestContext.cls.run(new RequestContext({ body: {} }, {}), fn);
}
