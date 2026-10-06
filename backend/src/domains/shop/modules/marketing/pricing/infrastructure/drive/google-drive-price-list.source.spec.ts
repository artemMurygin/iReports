import type { drive_v3 } from 'googleapis';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { GoogleDrivePriceListSource } from './google-drive-price-list.source';
import { PRICE_LIST_DRIVE_FOLDER_ID } from '../config/pricing.config';
import { PriceListFile } from '../../domain/value-objects/price-list-file.value-object';
import {
    PriceListFileAmbiguousException,
    PriceListFileNotFoundException,
} from '../../domain/exceptions/scheduled-price-import.exception';

const SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const XLSX_MIME =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function buildFakeDrive(
    files: Array<{ id: string; name: string; mimeType: string }>,
) {
    const list = jest.fn().mockResolvedValue({ data: { files } });
    const exportFn = jest
        .fn()
        .mockResolvedValue({ data: new Uint8Array([1, 2, 3]).buffer });
    const get = jest
        .fn()
        .mockResolvedValue({ data: new Uint8Array([4, 5]).buffer });
    const drive = {
        files: { list, export: exportFn, get },
    } as unknown as drive_v3.Drive;
    return { drive, list, exportFn, get };
}

describe('GoogleDrivePriceListSource', () => {
    // spec: shop/price-import-schedule#источник-прайс-листа
    it('ищет файлы только в папке прайс-листа, без корзины', async () => {
        const { drive, list } = buildFakeDrive([
            { id: 'f1', name: 'price', mimeType: SHEET_MIME },
        ]);
        await new GoogleDrivePriceListSource(drive).findPriceListFile();
        expect(list).toHaveBeenCalledWith(
            expect.objectContaining({
                q: `'${PRICE_LIST_DRIVE_FOLDER_ID}' in parents and trashed=false`,
                fields: 'files(id,name,mimeType)',
                pageSize: 10,
            }),
        );
    });

    it('возвращает единственный файл как PriceListFile', async () => {
        const { drive } = buildFakeDrive([
            { id: 'f1', name: 'price', mimeType: SHEET_MIME },
        ]);
        const file = await new GoogleDrivePriceListSource(
            drive,
        ).findPriceListFile();
        expect(file.getId()).toBe('f1');
        expect(file.getName()).toBe('price');
        expect(file.isGoogleSpreadsheet()).toBe(true);
    });

    it('пустая папка -> PriceListFileNotFoundException', async () => {
        const { drive } = buildFakeDrive([]);
        await withRequestContext(async () => {
            await expect(
                new GoogleDrivePriceListSource(drive).findPriceListFile(),
            ).rejects.toBeInstanceOf(PriceListFileNotFoundException);
        });
    });

    it('несколько файлов -> PriceListFileAmbiguousException', async () => {
        const { drive } = buildFakeDrive([
            { id: 'a', name: 'a', mimeType: SHEET_MIME },
            { id: 'b', name: 'b', mimeType: XLSX_MIME },
        ]);
        await withRequestContext(async () => {
            await expect(
                new GoogleDrivePriceListSource(drive).findPriceListFile(),
            ).rejects.toBeInstanceOf(PriceListFileAmbiguousException);
        });
    });

    it('Google-таблицу экспортирует в XLSX', async () => {
        const { drive, exportFn, get } = buildFakeDrive([]);
        const file = PriceListFile.create({
            id: 'f1',
            name: 'p',
            mimeType: SHEET_MIME,
        });
        const buf = await new GoogleDrivePriceListSource(drive).download(file);
        expect(exportFn).toHaveBeenCalledWith(
            { fileId: 'f1', mimeType: XLSX_MIME },
            { responseType: 'arraybuffer' },
        );
        expect(get).not.toHaveBeenCalled();
        expect([...buf]).toEqual([1, 2, 3]);
    });

    it('обычный файл скачивает как media', async () => {
        const { drive, exportFn, get } = buildFakeDrive([]);
        const file = PriceListFile.create({
            id: 'f2',
            name: 'p.xlsx',
            mimeType: XLSX_MIME,
        });
        const buf = await new GoogleDrivePriceListSource(drive).download(file);
        expect(get).toHaveBeenCalledWith(
            { fileId: 'f2', alt: 'media' },
            { responseType: 'arraybuffer' },
        );
        expect(exportFn).not.toHaveBeenCalled();
        expect([...buf]).toEqual([4, 5]);
    });
});
