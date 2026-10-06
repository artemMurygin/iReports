import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '@/integrations/telegram/telegram.service';
import type { PriceImportNotifier } from '../../application/ports/price-import-notifier.port';
import { TELEGRAM_CHAT_ID } from '../config/pricing.config';

// Тексты без технических деталей — spec: shop/price-import-schedule#уведомление-об-ошибке
export const UPLOADED_TEXT = 'Прайс-лист выгружен в таблицу переоценки. Обновлённые цены отправлены в Мой склад 👌';
export const UNCHANGED_TEXT =
    'Прайс-лист не изменился с прошлой выгрузки. Следите за обновлением прайс-листа и после обновления повторите выгрузку в ручном режиме.';
export const FAILED_TEXT =
    'Не удалось выгрузить прайс-лист. Проверьте выгрузку и при необходимости загрузите прайс вручную.';
export const PRICE_UPDATE_FAILED_TEXT =
    'Цены записаны в таблицу переоценки, но при выгрузке цен в Мой склад возникла ошибка. Повторите выгрузку цен в Мой склад в ручном режиме.';

// Реализация PRICE_IMPORT_NOTIFIER поверх TelegramService.
// spec: shop/price-import-schedule#отказоустойчивость-уведомлений — сбой доставки логируем и глотаем.
@Injectable()
export class TelegramPriceImportNotifier implements PriceImportNotifier {
    private readonly logger = new Logger(TelegramPriceImportNotifier.name);

    constructor(private readonly telegram: TelegramService) {}

    notifyUploaded(): Promise<void> {
        return this.send(UPLOADED_TEXT);
    }

    notifyUnchanged(): Promise<void> {
        return this.send(UNCHANGED_TEXT);
    }

    notifyFailed(): Promise<void> {
        return this.send(FAILED_TEXT);
    }

    notifyPriceUpdateFailed(): Promise<void> {
        return this.send(PRICE_UPDATE_FAILED_TEXT);
    }

    private async send(text: string): Promise<void> {
        try {
            await this.telegram.sendMessage(TELEGRAM_CHAT_ID, text);
        } catch (error) {
            // message сервиса уже очищен от токена
            this.logger.error(
                `Не удалось отправить уведомление в Telegram: ${error instanceof Error ? error.message : 'unknown'}`,
            );
        }
    }
}
