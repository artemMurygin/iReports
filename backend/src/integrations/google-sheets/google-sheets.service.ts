import { BadGatewayException, Injectable } from '@nestjs/common';
import { GoogleSheetsHttpService } from './google-sheets.instance';
import { GetRowsOptions, RangeData, SheetRow } from './google-sheets.types';

@Injectable()
export class GoogleSheetsService {
  constructor(private googleSheets: GoogleSheetsHttpService) {}

  /**
   * Получить строки из диапазона таблицы.
   * @param spreadsheetId — ID таблицы из URL
   * @param options.range — A1-нотация, например 'Sheet1!A1:Z'
   */
  async getRows(
    spreadsheetId: string,
    options: GetRowsOptions,
  ): Promise<SheetRow[]> {
    try {
      const { data } = await this.googleSheets.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: options.range,
        valueRenderOption: options.valueRenderOption ?? 'FORMATTED_VALUE',
      });

      return (data.values as SheetRow[]) ?? [];
    } catch (error) {
      throw new BadGatewayException(
        `Failed to get rows from Google Sheets: ${error.message}`,
      );
    }
  }

  /**
   * Обновить несколько диапазонов за один запрос (batchUpdate).
   * @param spreadsheetId — ID таблицы
   * @param data — массив { range, values }, где range в A1-нотации
   */
  async updateRows(
    spreadsheetId: string,
    data: RangeData[],
  ): Promise<void> {
    try {
      await this.googleSheets.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: data.map(({ range, values }) => ({ range, values })),
        },
      });
    } catch (error) {
      throw new BadGatewayException(
        `Failed to batch update rows in Google Sheets: ${error.message}`,
      );
    }
  }

  /**
   * Обновить одну ячейку.
   * @param spreadsheetId — ID таблицы
   * @param cell — A1-нотация ячейки, например 'Sheet1!B5'
   * @param value — новое значение
   */
  async getSheetNameByGid(
    spreadsheetId: string,
    gid: number,
  ): Promise<string> {
    try {
      const { data } = await this.googleSheets.sheets.spreadsheets.get({
        spreadsheetId,
      });

      const sheet = data.sheets?.find(
        (s) => s.properties?.sheetId === gid,
      );

      if (!sheet?.properties?.title) {
        throw new BadGatewayException(`Sheet with gid ${gid} not found`);
      }

      return sheet.properties.title;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        `Failed to get sheet name by gid: ${error.message}`,
      );
    }
  }

  async clearAndWriteRows(
    spreadsheetId: string,
    sheetName: string,
    rows: SheetRow[],
  ): Promise<void> {
    try {
      await this.googleSheets.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: sheetName,
      });

      await this.updateRows(spreadsheetId, [
        { range: `${sheetName}!A1`, values: rows },
      ]);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        `Failed to clear and write rows in Google Sheets: ${error.message}`,
      );
    }
  }

  async updateCell(
    spreadsheetId: string,
    cell: string,
    value: string | number | boolean,
  ): Promise<void> {
    try {
      await this.googleSheets.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: cell,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[value]] },
      });
    } catch (error) {
      throw new BadGatewayException(
        `Failed to update cell ${cell} in Google Sheets: ${error.message}`,
      );
    }
  }
}
