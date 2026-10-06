import { EventEmitter } from 'events';
import { HttpMetricsMiddleware } from './http-metrics.middleware';

function run(req: Record<string, unknown>, statusCode = 200) {
    const counter = { inc: jest.fn() };
    const histogram = { observe: jest.fn() };
    const mw = new HttpMetricsMiddleware(counter as never, histogram as never);
    const res = Object.assign(new EventEmitter(), { statusCode });
    const next = jest.fn();
    mw.use(req as never, res as never, next);
    res.emit('finish');
    return { counter, histogram, next };
}

describe('HttpMetricsMiddleware', () => {
    it('matched: route параметризован', () => {
        const { counter, histogram, next } = run({
            method: 'GET',
            originalUrl: '/deals/5',
            route: { path: '/deals/:id' },
        });
        const labels = {
            method: 'GET',
            route: '/deals/:id',
            status_code: '200',
        };
        expect(next).toHaveBeenCalled();
        expect(counter.inc).toHaveBeenCalledWith(labels);
        expect(histogram.observe).toHaveBeenCalledWith(
            labels,
            expect.any(Number),
        );
    });

    it('unmatched: route = unmatched', () => {
        const { counter } = run({ method: 'GET', originalUrl: '/nope/1' }, 404);
        expect(counter.inc).toHaveBeenCalledWith({
            method: 'GET',
            route: 'unmatched',
            status_code: '404',
        });
    });

    it('/metrics пропускается (в т.ч. с query)', () => {
        const { counter, histogram, next } = run({
            method: 'GET',
            originalUrl: '/metrics?x=1',
        });
        expect(next).toHaveBeenCalled();
        expect(counter.inc).not.toHaveBeenCalled();
        expect(histogram.observe).not.toHaveBeenCalled();
    });
});
