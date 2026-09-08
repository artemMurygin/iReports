import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import type { PriceListRow } from '../../domain/services/row-categorization.service';
import {
    IPAD_MACBOOK_PATTERNS,
    SHEET_IPAD_MACBOOK,
    SHEET_IPHONE_WATCH,
} from '../config/pricing.config';
import { getErrorMessage } from '@/shared/utils/getErrorMessage';

export interface ParsedPriceList {
    /** Строки листа iPhone/Watch — уже в финальном виде, AI-форматирование не требуется. */
    readonly iphoneWatchRows: PriceListRow[];
    /**
     * Строки листа iPad/MacBook, отфильтрованные `IPAD_MACBOOK_PATTERNS`, но ещё с исходными
     * названиями поставщика — приведение к единому формату (AI) делает вызывающая сторона через
     * `PRODUCT_MATCHER.formatProductNames`, это не забота парсера XLSX-структуры листа.
     */
    readonly ipadMacbookRawRows: PriceListRow[];
}

// Структурный парсинг прайса поставщика (Фаза 9, см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) — перенос
// PriceMonitoringService.parseXlsx/parseIphoneWatchSheet/parseIpadMacbookSheet
// (src/TODO/priceMonitoring/priceMonitoring.service.ts) без изменения структуры листов/колонок.
// Не за портом (нет DI-токена): это чистая, детерминированная трансформация байтов файла в строки —
// нечего подменять в тестах, в отличие от PRICE_IMPORT_JOB_STORE/PRODUCT_MATCHER/RESULT_SHEET_GATEWAY.
// AI-форматирование названий iPad/MacBook (легаси `formatNamesViaAi`) сюда намеренно не входит —
// это ответственность PRODUCT_MATCHER (единственный порт, за которым спрятан AiService).
@Injectable()
export class PriceListXlsxParser {
    private readonly logger = new Logger(PriceListXlsxParser.name);

    parse(fileBase64: string): ParsedPriceList {
        try {
            const buffer = Buffer.from(fileBase64, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            this.logger.log(`Листы в файле: ${workbook.SheetNames.join(', ')}`);

            const iphoneWatchRows = this.parseIphoneWatchSheet(workbook);
            this.logger.log(`iPhone/Watch: ${iphoneWatchRows.length} строк`);

            const ipadMacbookRawRows = this.parseIpadMacbookSheet(workbook);
            this.logger.log(`iPad/MacBook: ${ipadMacbookRawRows.length} строк`);

            return { iphoneWatchRows, ipadMacbookRawRows };
        } catch (e) {
            if (e instanceof BadRequestException) throw e;
            throw new BadRequestException(
                `Failed to parse XLSX file: ${getErrorMessage(e)}`,
            );
        }
    }

    private parseIphoneWatchSheet(workbook: XLSX.WorkBook): PriceListRow[] {
        const sheet = workbook.Sheets[SHEET_IPHONE_WATCH];
        if (!sheet) {
            throw new BadRequestException(
                `Sheet "${SHEET_IPHONE_WATCH}" not found`,
            );
        }

        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            defval: null,
        });

        return rows
            .slice(3)
            .map((row) => ({
                name: row[1] as string,
                price: row[3] as string | number | null,
            }))
            .filter((r) => r.name != null && r.name !== '');
    }

    private parseIpadMacbookSheet(workbook: XLSX.WorkBook): PriceListRow[] {
        const sheet = workbook.Sheets[SHEET_IPAD_MACBOOK];
        if (!sheet) {
            throw new BadRequestException(
                `Sheet "${SHEET_IPAD_MACBOOK}" not found`,
            );
        }

        const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            defval: null,
        });

        return raw
            .slice(4)
            .map((row) => ({
                name: row[0] as string,
                price: row[2] as string | number | null,
            }))
            .filter(
                (r) =>
                    r.name != null &&
                    r.name !== '' &&
                    IPAD_MACBOOK_PATTERNS.some((p) => p.test(r.name)),
            );
    }
}
