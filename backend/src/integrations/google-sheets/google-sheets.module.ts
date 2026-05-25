import { Module } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import { GoogleSheetsHttpService } from './google-sheets.instance';

@Module({
  providers: [GoogleSheetsHttpService, GoogleSheetsService],
  exports: [GoogleSheetsService],
})
export class GoogleSheetsModule {}
