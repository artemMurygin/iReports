import { RequestContextService } from './AppRequestContext';

// Обнаружено как реальный баг: AdministratorRoleSeeder (запускается через
// NestFactory.createApplicationContext, не HTTP-приложение) падал
// TypeError'ом "Cannot read properties of undefined (reading 'req')" при
// первом же обращении к БД через PrismaRepository.client/write — те методы
// безусловно дёргали RequestContextService.getContext(), которому вне
// RequestContextMiddleware (AsyncLocalStorage.getStore() === undefined)
// не на что опереться. Транзакционная машинерия ниже должна вместо этого
// вести себя так, будто транзакции просто нет — не бросать.
describe('RequestContextService вне HTTP-запроса (нет активного RequestContext)', () => {
    it('getTransactionConnection() возвращает undefined, а не бросает', () => {
        expect(
            RequestContextService.getTransactionConnection(),
        ).toBeUndefined();
    });

    it('setTransactionConnection()/cleanTransactionConnection() не бросают', () => {
        expect(() =>
            RequestContextService.setTransactionConnection({} as never),
        ).not.toThrow();
        expect(() =>
            RequestContextService.cleanTransactionConnection(),
        ).not.toThrow();
    });

    it('trackAggregateForEvents() не бросает, drainPendingAggregates() возвращает []', () => {
        expect(() =>
            RequestContextService.trackAggregateForEvents({} as never),
        ).not.toThrow();
        expect(RequestContextService.drainPendingAggregates()).toEqual([]);
    });

    it('getContext()/setRequestId()/getRequestId() по-прежнему требуют реального запроса и бросают', () => {
        expect(() => RequestContextService.getContext()).toThrow();
        expect(() => RequestContextService.setRequestId('x')).toThrow();
        expect(() => RequestContextService.getRequestId()).toThrow();
    });
});
