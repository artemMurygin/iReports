import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface PriceListFileProps {
    id: string;
    name: string;
    mimeType: string;
}

const GOOGLE_SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';

/**
 * Файл прайс-листа, найденный в папке Google Drive.
 * spec: shop/price-import-schedule#источник-прайс-листа
 */
export class PriceListFile extends ValueObject<PriceListFileProps> {
    static create(props: PriceListFileProps): PriceListFile {
        if (!props.id.trim()) {
            throw new ArgumentInvalidException('id файла не может быть пустым');
        }
        if (!props.name.trim()) {
            throw new ArgumentInvalidException(
                'name файла не может быть пустым',
            );
        }
        return new PriceListFile({ ...props });
    }

    getId(): string {
        return this.props.id;
    }

    getName(): string {
        return this.props.name;
    }

    getMimeType(): string {
        return this.props.mimeType;
    }

    /** Google-таблицу нужно экспортировать в XLSX, обычный файл — скачивать как есть. */
    isGoogleSpreadsheet(): boolean {
        return this.props.mimeType === GOOGLE_SPREADSHEET_MIME;
    }
}
