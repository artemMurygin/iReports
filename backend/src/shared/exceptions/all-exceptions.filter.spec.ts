import { ArgumentsHost, UnauthorizedException } from '@nestjs/common';
import { RequestContext } from 'nestjs-request-context';
import { ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ExceptionBase } from './exception.base';
import { CONFLICT } from './exception.codes';

class TestConflict extends ExceptionBase {
    code = CONFLICT;
}

function setup(headersSent = false) {
    const counter = { inc: jest.fn() };
    const filter = new AllExceptionsFilter(counter as never);
    const json = jest.fn();
    const res = {
        headersSent,
        locals: {} as Record<string, unknown>,
        err: undefined as unknown,
        status: jest.fn().mockReturnThis(),
        json,
    };
    const req = { id: 'req-1', method: 'POST', route: { path: '/things/:id' } };
    const host = {
        switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ArgumentsHost;
    return { filter, counter, res, req, host, json };
}

function inContext<T>(fn: () => T): T {
    return RequestContext.cls.run(
        { req: { requestId: 'ctx-1' } } as unknown as RequestContext,
        fn,
    );
}

describe('AllExceptionsFilter', () => {
    it('ExceptionBase -> статус по карте и доменный код', () => {
        const { filter, res, host, json, counter } = setup();
        const ex = inContext(
            () => new TestConflict('dup', undefined, { a: 1 }),
        );
        filter.catch(ex, host);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 409,
                error: CONFLICT,
                message: 'dup',
                correlationId: 'req-1',
                metadata: { a: 1 },
            }),
        );
        expect(res.err).toBe(ex);
        expect(res.locals.errorCode).toBe(CONFLICT);
        expect(counter.inc).toHaveBeenCalledWith({
            method: 'POST',
            route: '/things/:id',
            status_code: '409',
            error_code: CONFLICT,
        });
    });

    it('ZodValidationException -> 400 VALIDATION_FAILED с subErrors', () => {
        const { filter, res, host, json } = setup();
        const parsed = z.object({ a: z.string() }).safeParse({ a: 1 });
        if (parsed.success) throw new Error('unreachable');
        filter.catch(new ZodValidationException(parsed.error), host);
        expect(res.status).toHaveBeenCalledWith(400);
        const body = (json.mock.calls as unknown[][])[0][0] as {
            error: string;
            subErrors: Array<{ path: string; message: string }>;
        };
        expect(body.error).toBe('VALIDATION_FAILED');
        expect(body.subErrors).toEqual([
            { path: 'a', message: expect.any(String) as string },
        ]);
        expect(res.locals.errorCode).toBe('VALIDATION_FAILED');
    });

    it('UnauthorizedException -> 401 UNAUTHORIZED', () => {
        const { filter, res, host, json } = setup();
        filter.catch(new UnauthorizedException('Требуется вход'), host);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'UNAUTHORIZED',
                message: 'Требуется вход',
            }),
        );
    });

    it('неизвестная ошибка -> 500 без утечки message', () => {
        const { filter, res, host, json, counter } = setup();
        filter.catch(new Error('secret db password'), host);
        expect(res.status).toHaveBeenCalledWith(500);
        const body = (json.mock.calls as unknown[][])[0][0] as {
            message: string;
            error: string;
        };
        expect(body.error).toBe('INTERNAL_ERROR');
        expect(JSON.stringify(body)).not.toContain('secret');
        expect((res.err as Error).message).toBe('secret db password');
        expect(counter.inc).toHaveBeenCalledWith(
            expect.objectContaining({
                status_code: '500',
                error_code: 'INTERNAL_ERROR',
            }),
        );
    });

    it('не-Error значение оборачивается в Error', () => {
        const { filter, res, host } = setup();
        filter.catch('строка', host);
        expect(res.err).toBeInstanceOf(Error);
    });

    it('при headersSent ничего не отправляет, но данные для лога выставляет', () => {
        const { filter, res, host, json } = setup(true);
        filter.catch(new UnauthorizedException(), host);
        expect(res.status).not.toHaveBeenCalled();
        expect(json).not.toHaveBeenCalled();
        expect(res.locals.errorCode).toBe('UNAUTHORIZED');
    });
});
