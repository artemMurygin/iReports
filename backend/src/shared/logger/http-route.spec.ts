import { routeLabel, UNMATCHED_ROUTE } from './http-route';

describe('routeLabel', () => {
    it('возвращает параметризованный путь роута', () => {
        expect(routeLabel({ route: { path: '/v1/deals/:id' } })).toBe(
            '/v1/deals/:id',
        );
    });

    it('catch-all роут Express 5 (404) → unmatched', () => {
        expect(routeLabel({ route: { path: '/{*path}' } })).toBe(
            UNMATCHED_ROUTE,
        );
        expect(routeLabel({ route: { path: '*' } })).toBe(UNMATCHED_ROUTE);
    });

    it('без роута → unmatched', () => {
        expect(routeLabel({})).toBe(UNMATCHED_ROUTE);
        expect(routeLabel({ route: {} })).toBe(UNMATCHED_ROUTE);
    });
});
