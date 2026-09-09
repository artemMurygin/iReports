import { buildBitrixTaskLink } from './bitrix-task-link-builder';

// FR: раздел 7 tasks.md add-task-based-salary-rule — buildBitrixTaskLink
// строит ссылку на задачу Bitrix24 из портала BITRIX24_WEBHOOK_URL (design.md
// Decision 7), не хардкодя домен.
describe('buildBitrixTaskLink', () => {
    const originalWebhookUrl = process.env.BITRIX24_WEBHOOK_URL;

    afterEach(() => {
        if (originalWebhookUrl === undefined) {
            delete process.env.BITRIX24_WEBHOOK_URL;
        } else {
            process.env.BITRIX24_WEBHOOK_URL = originalWebhookUrl;
        }
    });

    it('строит ссылку на задачу из портала, взятого из BITRIX24_WEBHOOK_URL', () => {
        process.env.BITRIX24_WEBHOOK_URL =
            'https://irepair.bitrix24.ru/rest/12/8b659pktudu7xlqu/';

        expect(buildBitrixTaskLink('4821')).toBe(
            'https://irepair.bitrix24.ru/company/personal/user/0/tasks/task/view/4821/',
        );
    });

    it('не хардкодит домен — использует поддомен ЛЮБОГО заданного портала', () => {
        process.env.BITRIX24_WEBHOOK_URL =
            'https://another-portal.bitrix24.ru/rest/1/token/';

        expect(buildBitrixTaskLink('99')).toBe(
            'https://another-portal.bitrix24.ru/company/personal/user/0/tasks/task/view/99/',
        );
    });

    it('выбрасывает исключение, если BITRIX24_WEBHOOK_URL не задан', () => {
        delete process.env.BITRIX24_WEBHOOK_URL;

        expect(() => buildBitrixTaskLink('4821')).toThrow();
    });
});
