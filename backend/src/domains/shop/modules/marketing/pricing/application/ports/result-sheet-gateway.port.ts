import type { CostChange } from '../../domain/value-objects/cost-change.value-object';

// Порт записи результата импорта в Google Sheets (Фаза 9, см. PRD раздел 3а: "RESULT_SHEET_GATEWAY
// — Google Sheets") — прячет GoogleSheetsService и layout таблицы (номера строк/колонок) за
// интерфейсом, чтобы application-слой не знал про конкретный SPREADSHEET_ID/диапазоны ячеек.
export interface ResultSheetGateway {
    /**
     * Записывает новые закупочные цены в таблицу с ценами магазина — перенос легаси
     * `writeResultsToSheet` (включая предварительный сброс колонки "Закуп" через
     * `resetCostsToNull`, который выполняется только если реально есть что записывать). Товар,
     * которому таблица не сопоставила строку (нет его externalId в колонке A), молча пропускается —
     * то же поведение, что и в легаси.
     */
    writeCostChanges(costChanges: CostChange[]): Promise<void>;
}

export const RESULT_SHEET_GATEWAY = Symbol('RESULT_SHEET_GATEWAY');
