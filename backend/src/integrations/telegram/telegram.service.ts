import { Injectable } from '@nestjs/common';
import axios from 'axios';

// Отправка сообщений через Telegram Bot API. Токен берётся из TELEGRAM_BOT_TOKEN и нигде не
// логируется: URL запроса содержит токен, поэтому исходную axios-ошибку наружу не отдаём.
@Injectable()
export class TelegramService {
    async sendMessage(chatId: string, text: string): Promise<void> {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            throw new Error(
                'Не задана переменная окружения TELEGRAM_BOT_TOKEN — отправка в Telegram невозможна',
            );
        }

        try {
            await axios.post(
                `https://api.telegram.org/bot${token}/sendMessage`,
                {
                    chat_id: chatId,
                    text,
                },
            );
        } catch (error) {
            // Только статус ответа, без url/config/cause исходной ошибки (там токен)
            const status = axios.isAxiosError?.(error)
                ? error.response?.status
                : undefined;
            throw new Error(
                `Не удалось отправить сообщение в Telegram${status ? ` (HTTP ${status})` : ''}`,
            );
        }
    }
}
