import { Cron } from '@nestjs/schedule';
import { ProdCron } from './prod-cron.decorator';

jest.mock('@nestjs/schedule', () => ({
    Cron: jest.fn(() => jest.fn()),
}));

describe('ProdCron', () => {
    const prev = process.env.ENABLE_CRON;

    beforeEach(() => {
        (Cron as jest.Mock).mockClear();
    });

    afterEach(() => {
        if (prev === undefined) delete process.env.ENABLE_CRON;
        else process.env.ENABLE_CRON = prev;
    });

    it('при ENABLE_CRON!=="true" возвращает no-op и не регистрирует Cron', () => {
        process.env.ENABLE_CRON = 'false';
        const decorator = ProdCron('0 10 * * *', { timeZone: 'Europe/Moscow' });
        expect(typeof decorator).toBe('function');
        expect(Cron).not.toHaveBeenCalled();
    });

    it('при ENABLE_CRON==="true" без options вызывает Cron(expr, undefined)', () => {
        process.env.ENABLE_CRON = 'true';
        ProdCron('0 10 * * *');
        expect(Cron).toHaveBeenCalledWith('0 10 * * *', undefined);
    });

    it('при ENABLE_CRON==="true" передаёт options в Cron', () => {
        process.env.ENABLE_CRON = 'true';
        ProdCron('30 12 * * 1-5', { timeZone: 'Europe/Moscow' });
        expect(Cron).toHaveBeenCalledWith('30 12 * * 1-5', {
            timeZone: 'Europe/Moscow',
        });
    });
});
