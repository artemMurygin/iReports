import {
    extractIdFromHref,
    extractPurchaserExternalId,
    PURCHASER_ATTRIBUTE_NAME,
} from './moysklad-sync.mappers';

// Фаза 10 (issue #51): резолв доп. поля закупщика БУ техники — тип
// значения атрибута в проде заранее не известен (открытый вопрос PRD),
// поэтому extractPurchaserExternalId обязан корректно обрабатывать оба
// варианта, описанных в docs/payroll/prd-payroll-calculation.md.
describe('extractPurchaserExternalId', () => {
    it('извлекает id сотрудника МойСклад из атрибута типа employee (MetaWrapper со ссылкой)', () => {
        const attributes = [
            {
                name: PURCHASER_ATTRIBUTE_NAME.ONLINE,
                type: 'employee',
                value: {
                    meta: {
                        href: 'https://api.moysklad.ru/api/remap/1.2/entity/employee/abc-123',
                    },
                },
            },
        ];

        const result = extractPurchaserExternalId(
            attributes,
            PURCHASER_ATTRIBUTE_NAME.ONLINE,
        );

        expect(result).toBe('abc-123');
    });

    it('использует голое строковое значение для атрибута произвольного (не employee) типа', () => {
        const attributes = [
            {
                name: PURCHASER_ATTRIBUTE_NAME.OFFLINE,
                type: 'string',
                value: 'Петров П.П.',
            },
        ];

        const result = extractPurchaserExternalId(
            attributes,
            PURCHASER_ATTRIBUTE_NAME.OFFLINE,
        );

        expect(result).toBe('Петров П.П.');
    });

    it('возвращает null, если атрибут с таким именем не найден', () => {
        const attributes = [
            {
                name: 'Совсем другой атрибут',
                type: 'string',
                value: 'что-то',
            },
        ];

        expect(
            extractPurchaserExternalId(
                attributes,
                PURCHASER_ATTRIBUTE_NAME.ONLINE,
            ),
        ).toBeNull();
    });

    it('возвращает null для пустого/undefined значения атрибута', () => {
        const attributes = [
            {
                name: PURCHASER_ATTRIBUTE_NAME.ONLINE,
                type: 'employee',
                value: null,
            },
        ];

        expect(
            extractPurchaserExternalId(
                attributes,
                PURCHASER_ATTRIBUTE_NAME.ONLINE,
            ),
        ).toBeNull();
    });

    it('возвращает null, если позиция вообще не несёт атрибутов', () => {
        expect(
            extractPurchaserExternalId(
                undefined,
                PURCHASER_ATTRIBUTE_NAME.ONLINE,
            ),
        ).toBeNull();
    });
});

describe('extractIdFromHref', () => {
    it('вытаскивает id из конца href', () => {
        expect(
            extractIdFromHref(
                'https://api.moysklad.ru/api/remap/1.2/entity/employee/xyz-789',
            ),
        ).toBe('xyz-789');
    });

    it('возвращает null для отсутствующего href', () => {
        expect(extractIdFromHref(null)).toBeNull();
        expect(extractIdFromHref(undefined)).toBeNull();
    });
});
