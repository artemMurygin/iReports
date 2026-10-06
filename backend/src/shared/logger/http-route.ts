// Express 5 / Nest 11 регистрируют not-found-хендлер как catch-all роут, поэтому
// у несовпавшего URL req.route.path = '/{*path}', а не undefined. Для метрик и
// логов это один и тот же случай «маршрут не найден» — приводим к константе,
// чтобы кардинальность лейбла route не зависела от формы catch-all паттерна.
const CATCH_ALL_ROUTES = new Set(['/{*path}', '/*', '*', '/(.*)']);

export const UNMATCHED_ROUTE = 'unmatched';

/** Параметризованный путь роута ('/deals/:id') или 'unmatched' для 404. */
export function routeLabel(req: { route?: { path?: unknown } }): string {
    const path = req.route?.path;
    if (typeof path !== 'string' || CATCH_ALL_ROUTES.has(path)) {
        return UNMATCHED_ROUTE;
    }
    return path;
}
