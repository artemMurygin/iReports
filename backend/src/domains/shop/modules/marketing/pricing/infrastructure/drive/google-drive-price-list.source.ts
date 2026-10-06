import { Injectable, Optional } from '@nestjs/common';
import type { drive_v3 } from 'googleapis';
import { getGoogleServiceAccountCredentials } from '@/integrations/google-sheets/google-service-account-credentials';
import type { PriceListSource } from '../../application/ports/price-list-source.port';
import {
    PriceListFileAmbiguousException,
    PriceListFileNotFoundException,
} from '../../domain/exceptions/scheduled-price-import.exception';
import { PriceListFile } from '../../domain/value-objects/price-list-file.value-object';
import { PRICE_LIST_DRIVE_FOLDER_ID } from '../config/pricing.config';

const XLSX_MIME =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Drive-клиент сервисного аккаунта (googleapis грузится лениво). */
function createDriveClient(): drive_v3.Drive {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { google } = require('googleapis') as typeof import('googleapis');
    const auth = new google.auth.GoogleAuth({
        credentials: getGoogleServiceAccountCredentials(),
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
}

/**
 * Прайс-лист из папки Google Drive.
 * spec: shop/price-import-schedule#источник-прайс-листа
 */
@Injectable()
export class GoogleDrivePriceListSource implements PriceListSource {
    private drive?: drive_v3.Drive;

    // клиент можно подменить (тесты); иначе создаётся лениво при первом вызове.
    // @Optional — тип drive_v3.Drive импортирован как type и в рантайме это Object: без декоратора
    // Nest пытается найти его в DI и падает на старте приложения.
    constructor(@Optional() drive?: drive_v3.Drive) {
        this.drive = drive;
    }

    private getDrive(): drive_v3.Drive {
        return (this.drive ??= createDriveClient());
    }

    async findPriceListFile(): Promise<PriceListFile> {
        const { data } = await this.getDrive().files.list({
            q: `'${PRICE_LIST_DRIVE_FOLDER_ID}' in parents and trashed=false`,
            fields: 'files(id,name,mimeType)',
            pageSize: 10,
        });
        const files = data.files ?? [];
        if (files.length === 0) throw new PriceListFileNotFoundException();
        if (files.length > 1) {
            throw new PriceListFileAmbiguousException(files.length);
        }
        const [file] = files;
        return PriceListFile.create({
            id: file.id as string,
            name: file.name as string,
            mimeType: file.mimeType as string,
        });
    }

    async download(file: PriceListFile): Promise<Buffer> {
        const files = this.getDrive().files;
        // Google-таблицу нельзя скачать как media — экспортируем в XLSX
        const { data } = file.isGoogleSpreadsheet()
            ? await files.export(
                  { fileId: file.getId(), mimeType: XLSX_MIME },
                  { responseType: 'arraybuffer' },
              )
            : await files.get(
                  { fileId: file.getId(), alt: 'media' },
                  { responseType: 'arraybuffer' },
              );
        return Buffer.from(data as ArrayBuffer);
    }
}
