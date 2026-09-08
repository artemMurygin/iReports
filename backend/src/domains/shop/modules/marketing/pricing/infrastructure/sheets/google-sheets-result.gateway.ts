import { Injectable, Logger } from '@nestjs/common';
import { GoogleSheetsService } from '@/integrations/google-sheets/google-sheets.service';
import type { ResultSheetGateway } from '../../application/ports/result-sheet-gateway.port';
import type { CostChange } from '../../domain/value-objects/cost-change.value-object';
import { SHEET_GID, SPREADSHEET_ID } from '../config/pricing.config';

// Реализация RESULT_SHEET_GATEWAY поверх существующего GoogleSheetsService (Фаза 9) — перенос
// легаси `PriceMonitoringService.writeResultsToSheet`/`resetCostsToNull`
// (src/TODO/priceMonitoring/priceMonitoring.service.ts) без изменения layout таблицы: колонка A —
// externalId товара МойСклад начиная со строки 5, AN — сбрасываемая колонка "Закуп", AO — колонка,
// в которую пишется новая закупочная цена.
@Injectable()
export class GoogleSheetsResultGateway implements ResultSheetGateway {
    private readonly logger = new Logger(GoogleSheetsResultGateway.name);

    constructor(private readonly sheets: GoogleSheetsService) {}

    async writeCostChanges(costChanges: CostChange[]): Promise<void> {
        const sheetName = await this.sheets.getSheetNameByGid(
            SPREADSHEET_ID,
            SHEET_GID,
        );

        // Читаем только колонку A (externalId) начиная с 5-й строки
        const rows = await this.sheets.getRows(SPREADSHEET_ID, {
            range: `${sheetName}!A5:A`,
        });

        // Строим индекс: externalId → номер строки в таблице
        const idToSheetRow = new Map<string, number>();
        rows.forEach((row, i) => {
            const id = row[0]?.toString().trim();
            if (id) idToSheetRow.set(id, 5 + i);
        });

        // Собираем batch-обновления только для товаров, которым таблица сопоставила строку
        const updates = costChanges
            .filter((change) => idToSheetRow.has(change.getProductId()))
            .map((change) => ({
                range: `${sheetName}!AO${idToSheetRow.get(change.getProductId())}`,
                values: [[String(change.getNewCost())]],
            }));

        if (updates.length === 0) {
            this.logger.log(
                'Нет позиций для обновления в таблице — цены не изменены',
            );
            return;
        }

        // Сброс происходит только если есть что записывать — старые цены не затираются зря
        await this.resetCostsToNull(sheetName);
        await this.sheets.updateRows(SPREADSHEET_ID, updates);
        this.logger.log(`Обновлено в таблице: ${updates.length} строк`);
    }

    private async resetCostsToNull(sheetName: string): Promise<void> {
        const rows = await this.sheets.getRows(SPREADSHEET_ID, {
            range: `${sheetName}!A3:AN`,
        });

        // rows[0] = строка 3 (заголовок), rows[1] = строка 4, rows[2..] = данные с 5-й строки
        const dataRows = rows.slice(2);

        const rowsWithId = dataRows
            .map((row, i) => ({ row, sheetRow: 5 + i }))
            .filter(({ row }) => row[0]?.toString().trim() !== '');

        if (rowsWithId.length === 0) return;

        const updates = rowsWithId.map(({ sheetRow }) => ({
            range: `${sheetName}!AN${sheetRow}`,
            values: [['0']],
        }));

        await this.sheets.updateRows(SPREADSHEET_ID, updates);
        this.logger.log(`Сброшено "Закуп" до 0: ${updates.length} строк`);
    }
}
