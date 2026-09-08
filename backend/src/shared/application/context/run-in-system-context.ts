import { RequestContext } from 'nestjs-request-context';
import { nanoid } from 'nanoid';
import { RequestContextService } from './AppRequestContext';

// Домен/UnitOfWork читают RequestContext через RequestContextService
// (correlationId в исключениях, транзакция в DatabaseService.getClient() —
// см. AppRequestContext.ts) в предположении, что AsyncLocalStorage-контекст
// уже открыт. В HTTP-запросах это делает RequestContextMiddleware
// (app.module.ts), но код, вызываемый кроном (@ProdCron), выполняется вне
// этого middleware — без обёртки любое чтение/запись через репозиторий
// упадёт с TypeError ("Cannot read properties of undefined"), т.к.
// RequestContext.currentContext ничем не заполнен. Эта функция открывает
// тот же контекст вручную — аналог RequestContextMiddleware +
// ContextInterceptor (см. requestId) для кода без HTTP-запроса.
export function runInSystemRequestContext<T>(fn: () => Promise<T>): Promise<T> {
    return RequestContext.cls.run(
        new RequestContext({ body: {} }, {}),
        async () => {
            RequestContextService.setRequestId(nanoid(6));
            return fn();
        },
    );
}
