import { Injectable } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { getGoogleServiceAccountCredentials } from './google-service-account-credentials';

@Injectable()
export class GoogleSheetsHttpService {
    readonly sheets: sheets_v4.Sheets;

    constructor() {
        const auth = new google.auth.GoogleAuth({
            credentials: getGoogleServiceAccountCredentials(),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        this.sheets = google.sheets({ version: 'v4', auth });
    }
}
