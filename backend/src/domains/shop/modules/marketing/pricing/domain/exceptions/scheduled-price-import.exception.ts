import { ConflictException, NotFoundException } from '@/shared/exceptions';

// spec: shop/price-import-schedule#источник-прайс-листа
export class PriceListFileNotFoundException extends NotFoundException {
    constructor() {
        super('В папке Google Drive нет файла прайс-листа');
    }
}

export class PriceListFileAmbiguousException extends ConflictException {
    constructor(count: number) {
        super(
            `В папке Google Drive ${count} файлов вместо одного — непонятно, какой из них прайс-лист`,
        );
    }
}

// spec: shop/price-import-schedule#не-более-одной-выгрузки-одновременно
export class PriceImportAlreadyRunningException extends ConflictException {
    constructor() {
        super('Другая выгрузка цен уже выполняется');
    }
}
