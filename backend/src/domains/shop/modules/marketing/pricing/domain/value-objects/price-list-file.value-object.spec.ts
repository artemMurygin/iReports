import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { PriceListFile } from './price-list-file.value-object';

const SHEET_MIME = 'application/vnd.google-apps.spreadsheet';

describe('PriceListFile', () => {
    // spec: shop/price-import-schedule#источник-прайс-листа
    it('создаётся из валидных полей', () => {
        const file = PriceListFile.create({
            id: 'f1',
            name: 'Прайс 06.10',
            mimeType: 'application/x',
        });
        expect(file.getId()).toBe('f1');
        expect(file.getName()).toBe('Прайс 06.10');
    });

    it.each([
        ['id', { id: ' ', name: 'n', mimeType: 'm' }],
        ['name', { id: 'i', name: '', mimeType: 'm' }],
    ])('отклоняет пустой %s', (_f, props) => {
        withRequestContext(() => {
            expect(() => PriceListFile.create(props)).toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('isGoogleSpreadsheet отличает Google-таблицу от загруженного файла', () => {
        const sheet = PriceListFile.create({
            id: 'i',
            name: 'n',
            mimeType: SHEET_MIME,
        });
        const xlsx = PriceListFile.create({
            id: 'i',
            name: 'n',
            mimeType: 'application/octet-stream',
        });
        expect(sheet.isGoogleSpreadsheet()).toBe(true);
        expect(xlsx.isGoogleSpreadsheet()).toBe(false);
    });
});
