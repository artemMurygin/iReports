import { TelegramService } from '@/integrations/telegram/telegram.service';
import { TELEGRAM_CHAT_ID } from '../config/pricing.config';
import {
    FAILED_TEXT,
    MANUAL_FAILED_TEXT,
    MANUAL_UPLOADED_TEXT,
    PRICE_UPDATE_FAILED_TEXT,
    TelegramPriceImportNotifier,
    UNCHANGED_TEXT,
    UPLOADED_TEXT,
} from './telegram-price-import.notifier';

describe('TelegramPriceImportNotifier', () => {
    let send: jest.Mock;
    let notifier: TelegramPriceImportNotifier;

    beforeEach(() => {
        send = jest.fn().mockResolvedValue(undefined);
        notifier = new TelegramPriceImportNotifier({
            sendMessage: send,
        });
    });

    it('notifyUploaded шлёт текст об успешной выгрузке в группу', async () => {
        await notifier.notifyUploaded();
        expect(send).toHaveBeenCalledWith(TELEGRAM_CHAT_ID, UPLOADED_TEXT);
    });

    it('notifyUnchanged просит следить за прайсом и загружать вручную', async () => {
        await notifier.notifyUnchanged();
        expect(send).toHaveBeenCalledWith(TELEGRAM_CHAT_ID, UNCHANGED_TEXT);
        expect(UNCHANGED_TEXT).toMatch(/не изменил/);
        expect(UNCHANGED_TEXT).toMatch(/ручн/);
    });

    it('notifyFailed шлёт общий текст без технических деталей', async () => {
        await notifier.notifyFailed();
        expect(send).toHaveBeenCalledWith(TELEGRAM_CHAT_ID, FAILED_TEXT);
        expect(FAILED_TEXT).toMatch(/не удалось выгрузить прайс/i);
    });

    // spec: shop/price-import-schedule#обновление-цен-в-моём-складе-через-n8n
    it('notifyPriceUpdateFailed сообщает, что цены в переоценке, а в МойСклад не ушли, и просит повторить вручную', async () => {
        await notifier.notifyPriceUpdateFailed();
        expect(send).toHaveBeenCalledWith(
            TELEGRAM_CHAT_ID,
            PRICE_UPDATE_FAILED_TEXT,
        );
        expect(PRICE_UPDATE_FAILED_TEXT).toMatch(/переоценк/i);
        expect(PRICE_UPDATE_FAILED_TEXT).toMatch(/склад/i);
        expect(PRICE_UPDATE_FAILED_TEXT).toMatch(/вручную|ручн/i);
    });

    // spec: shop/price-import-schedule#уведомления-о-ручной-выгрузке
    it('notifyManualUploaded сообщает, что прайс выгружен в переоценку', async () => {
        await notifier.notifyManualUploaded();
        expect(send).toHaveBeenCalledWith(
            TELEGRAM_CHAT_ID,
            MANUAL_UPLOADED_TEXT,
        );
        expect(MANUAL_UPLOADED_TEXT).toMatch(/переоценк/i);
    });

    it('notifyManualFailed сообщает об ошибке выгрузки без технических деталей', async () => {
        await notifier.notifyManualFailed();
        expect(send).toHaveBeenCalledWith(TELEGRAM_CHAT_ID, MANUAL_FAILED_TEXT);
        expect(MANUAL_FAILED_TEXT).toMatch(/не удалось/i);
    });

    it('тексты не содержат стек и токен', () => {
        for (const t of [
            MANUAL_UPLOADED_TEXT,
            MANUAL_FAILED_TEXT,
            UPLOADED_TEXT,
            UNCHANGED_TEXT,
            FAILED_TEXT,
            PRICE_UPDATE_FAILED_TEXT,
        ]) {
            expect(t).not.toMatch(/\bat \w.*\(|Error|bot\d|token/i);
        }
    });

    it.each([
        'notifyUploaded',
        'notifyUnchanged',
        'notifyFailed',
        'notifyPriceUpdateFailed',
        'notifyManualUploaded',
        'notifyManualFailed',
    ] as const)('%s: сбой sendMessage не пробрасывается', async (method) => {
        send.mockRejectedValue(new Error('boom'));
        await expect(notifier[method]()).resolves.toBeUndefined();
    });
});
