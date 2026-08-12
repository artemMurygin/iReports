import type { GoogleSheetsService } from '@/integrations/google-sheets/google-sheets.service';
import { GoogleSheetsResultGateway } from './google-sheets-result.gateway';
import { CostChange } from '../../domain/value-objects/cost-change.value-object';
import { SHEET_GID, SPREADSHEET_ID } from '../config/pricing.config';

function buildFakeSheets(rowsByRange: Record<string, string[][]>) {
    const getSheetNameByGid = jest.fn().mockResolvedValue('Товары');
    const getRows = jest
        .fn()
        .mockImplementation(
            (_spreadsheetId: string, options: { range: string }) =>
                Promise.resolve(rowsByRange[options.range] ?? []),
        );
    const updateRows = jest.fn().mockResolvedValue(undefined);
    const sheets = {
        getSheetNameByGid,
        getRows,
        updateRows,
    } as unknown as GoogleSheetsService;
    return { sheets, getSheetNameByGid, getRows, updateRows };
}

describe('GoogleSheetsResultGateway', () => {
    it('пишет новую цену только для товаров, которым таблица сопоставила строку (по колонке A)', async () => {
        const { sheets, updateRows } = buildFakeSheets({
            'Товары!A5:A': [['ms-1'], ['ms-2']],
            'Товары!A3:AN': [
                [], // строка 3 (заголовок)
                [], // строка 4
                ['ms-1'], // строка 5
                ['ms-2'], // строка 6
            ],
        });
        const gateway = new GoogleSheetsResultGateway(sheets);

        const costChanges = [
            CostChange.create({
                productId: 'ms-1',
                productName: 'Товар 1',
                oldCost: null,
                newCost: 1000,
            }),
            CostChange.create({
                productId: 'unknown', // нет строки в таблице — пропускается
                productName: 'Товар 2',
                oldCost: null,
                newCost: 2000,
            }),
        ];

        await gateway.writeCostChanges(costChanges);

        // Первый вызов — сброс "Закуп" до 0, второй — запись новых цен.
        expect(updateRows).toHaveBeenCalledTimes(2);
        expect(updateRows).toHaveBeenNthCalledWith(1, SPREADSHEET_ID, [
            { range: 'Товары!AN5', values: [['0']] },
            { range: 'Товары!AN6', values: [['0']] },
        ]);
        expect(updateRows).toHaveBeenNthCalledWith(2, SPREADSHEET_ID, [
            { range: 'Товары!AO5', values: [['1000']] },
        ]);
    });

    it('ничего не пишет и не сбрасывает "Закуп", если нет ни одного сопоставленного изменения', async () => {
        const { sheets, updateRows } = buildFakeSheets({
            'Товары!A5:A': [['ms-1']],
        });
        const gateway = new GoogleSheetsResultGateway(sheets);

        await gateway.writeCostChanges([
            CostChange.create({
                productId: 'unknown',
                productName: 'Товар',
                oldCost: null,
                newCost: 500,
            }),
        ]);

        expect(updateRows).not.toHaveBeenCalled();
    });

    it('использует SHEET_GID модуля для получения имени листа', async () => {
        const { sheets, getSheetNameByGid } = buildFakeSheets({});
        const gateway = new GoogleSheetsResultGateway(sheets);

        await gateway.writeCostChanges([]);

        expect(getSheetNameByGid).toHaveBeenCalledWith(
            SPREADSHEET_ID,
            SHEET_GID,
        );
    });
});
