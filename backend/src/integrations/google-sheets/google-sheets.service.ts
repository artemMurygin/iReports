import { BadGatewayException, Injectable } from '@nestjs/common';
import { GoogleSheetsHttpService } from './google-sheets.instance';
import { GetRowsOptions, RangeData, SheetRow } from './google-sheets.types';
import { getErrorMessage } from '../../shared/utils/getErrorMessage';

@Injectable()
export class GoogleSheetsService {
    constructor(private googleSheets: GoogleSheetsHttpService) {}

    async getRows(
        spreadsheetId: string,
        options: GetRowsOptions,
    ): Promise<SheetRow[]> {
        try {
            const { data } =
                await this.googleSheets.sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: options.range,
                    valueRenderOption:
                        options.valueRenderOption ?? 'FORMATTED_VALUE',
                });

            return (data.values as SheetRow[]) ?? [];
        } catch (error) {
            throw new BadGatewayException(
                `Failed to get rows from Google Sheets: ${getErrorMessage(error)}`,
            );
        }
    }

    async updateRows(spreadsheetId: string, data: RangeData[]): Promise<void> {
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
                `Failed to batch update rows in Google Sheets: ${getErrorMessage(error)}`,
            );
        }
    }

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
                throw new BadGatewayException(
                    `Sheet with gid ${gid} not found`,
                );
            }

            return sheet.properties.title;
        } catch (error) {
            if (error instanceof BadGatewayException) throw error;
            throw new BadGatewayException(
                `Failed to get sheet name by gid: ${getErrorMessage(error)}`,
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
                `Failed to clear and write rows in Google Sheets: ${getErrorMessage(error)}`,
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
                `Failed to update cell ${cell} in Google Sheets: ${getErrorMessage(error)}`,
            );
        }
    }
}
