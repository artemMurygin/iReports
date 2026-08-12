import * as XLSX from 'xlsx';
import { BadRequestException } from '@nestjs/common';
import { PriceListXlsxParser } from './price-list-xlsx.parser';

// ВАЖНО: полностью пустая строка (`[]`) в aoa_to_sheet не занимает место в итоговом листе — XLSX
// схлопывает диапазон до первой строки, где реально есть ячейка. Строки-заполнители перед данными
// нужно писать с хотя бы одной непустой ячейкой (см. использование ниже), иначе `.slice(3)`/
// `.slice(4)` в парсере отсчитывают не от той строки.
function buildWorkbookBase64(sheets: Record<string, unknown[][]>): string {
    const workbook = XLSX.utils.book_new();
    for (const [name, aoa] of Object.entries(sheets)) {
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.aoa_to_sheet(aoa),
            name,
        );
    }
    const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
    }) as Buffer;
    return buffer.toString('base64');
}

describe('PriceListXlsxParser', () => {
    const parser = new PriceListXlsxParser();

    it('парсит iPhone/Watch с 4-й строки (колонка B — имя, D — цена)', () => {
        // Первые 3 строки — непустые "заполнители" (шапка), иначе XLSX схлопывает лист до первой
        // строки с данными и `.slice(3)` в парсере съедает не то — см. комментарий в
        // buildWorkbookBase64.
        const fileBase64 = buildWorkbookBase64({
            'Apple(iPhone, Watch)': [
                ['—'],
                ['—'],
                ['—'],
                ['', 'Apple iPhone 16 128GB', '', 65000],
                ['', '', '', null], // пустое имя — отфильтровывается
            ],
            'Apple (iPad, Macbook)': [['—'], ['—'], ['—'], ['—']],
        });

        const { iphoneWatchRows, ipadMacbookRawRows } =
            parser.parse(fileBase64);

        expect(iphoneWatchRows).toEqual([
            { name: 'Apple iPhone 16 128GB', price: 65000 },
        ]);
        expect(ipadMacbookRawRows).toEqual([]);
    });

    it('парсит iPad/MacBook с 5-й строки и фильтрует по IPAD_MACBOOK_PATTERNS', () => {
        const fileBase64 = buildWorkbookBase64({
            'Apple(iPhone, Watch)': [['—'], ['—'], ['—']],
            'Apple (iPad, Macbook)': [
                ['—'],
                ['—'],
                ['—'],
                ['—'],
                ['MacBook Air 13 Midnight', '', 120000],
                ['Не относится к категории', '', 1000], // не матчит ни один паттерн
            ],
        });

        const { ipadMacbookRawRows } = parser.parse(fileBase64);

        expect(ipadMacbookRawRows).toEqual([
            { name: 'MacBook Air 13 Midnight', price: 120000 },
        ]);
    });

    it('бросает BadRequestException, если нужного листа нет в файле', () => {
        const fileBase64 = buildWorkbookBase64({ 'Другой лист': [[]] });

        expect(() => parser.parse(fileBase64)).toThrow(BadRequestException);
    });

    it('бросает BadRequestException на некорректном base64/файле', () => {
        expect(() => parser.parse('это не xlsx')).toThrow(BadRequestException);
    });
});
