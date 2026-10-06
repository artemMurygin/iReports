import axios from 'axios';
import { TelegramService } from './telegram.service';

jest.mock('axios');
const mockedPost = axios.post as jest.Mock;

describe('TelegramService', () => {
    const TOKEN = 'secret-token-123';
    let service: TelegramService;
    const prev = process.env.TELEGRAM_BOT_TOKEN;

    beforeEach(() => {
        mockedPost.mockReset();
        process.env.TELEGRAM_BOT_TOKEN = TOKEN;
        service = new TelegramService();
    });

    afterAll(() => {
        if (prev === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = prev;
    });

    it('шлёт sendMessage в Bot API с chat_id и text', async () => {
        mockedPost.mockResolvedValue({ data: { ok: true } });

        await service.sendMessage('-100', 'привет');

        expect(mockedPost).toHaveBeenCalledWith(
            `https://api.telegram.org/bot${TOKEN}/sendMessage`,
            { chat_id: '-100', text: 'привет' },
        );
    });

    it('без токена бросает понятную ошибку и не вызывает API', async () => {
        delete process.env.TELEGRAM_BOT_TOKEN;

        await expect(service.sendMessage('-100', 'x')).rejects.toThrow(
            /TELEGRAM_BOT_TOKEN/,
        );
        expect(mockedPost).not.toHaveBeenCalled();
    });

    it('ошибка axios оборачивается без url и токена', async () => {
        mockedPost.mockRejectedValue(
            Object.assign(
                new Error(
                    `Request failed for https://api.telegram.org/bot${TOKEN}/sendMessage`,
                ),
                {
                    config: {
                        url: `https://api.telegram.org/bot${TOKEN}/sendMessage`,
                    },
                },
            ),
        );

        const err = await service.sendMessage('-100', 'x').catch((e) => e);

        expect(err).toBeInstanceOf(Error);
        expect(String(err.message)).not.toContain(TOKEN);
        expect(String(err.stack)).not.toContain(TOKEN);
        expect(JSON.stringify(err)).not.toContain(TOKEN);
        expect(err.cause).toBeUndefined();
    });
});
